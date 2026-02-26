#!/usr/bin/env python3
"""
Comprehensive import of a user and ALL related entities from Google Datastore into MongoDB.

Imports: User, Characters, Pets, UserData (InfoElement), USERCODEs,
         Marks (email, character names), Mail, Backups

All IDs and keys are properly prefixed:
  US_=user, CH_=character, GU_=guild, PT_=pet, ML_=mail, EV_=event,
  BC_=backup, IE_=infoelement, MK_=mark

Key mapping rules:
  - Runtime does get("IE_userdata-" + user._id) → IE_userdata-US_{id}
  - Runtime does get("IE_USERCODE-" + user._id + "-" + slot) → IE_USERCODE-US_{id}-{slot}
  - Slot keys: 1-100 = generic (string), >100 = character ID → CH_ prefix
  - Runtime does get("MK_email-" + email), get("MK_character-" + name.toLowerCase())

Usage:
  python import_from_datastore.py <email>
  python import_from_datastore.py ariaharper0@gmail.com
  DRY_RUN=1 python import_from_datastore.py ariaharper0@gmail.com
"""

import os
import sys
import pickle
import io
import datetime
from google.cloud import datastore
from pymongo import MongoClient

# ==================== Config ====================

os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "..", "secretsandconfig", "twodimensionalgame_datastore_reader.json",
)

from mongo_config import MONGO_URI, MONGO_DB

DRY_RUN = os.environ.get("DRY_RUN", "0") == "1"

# Entity ID prefixes
PREFIX = {
    "User": "US_",
    "Character": "CH_",
    "Guild": "GU_",
    "Pet": "PT_",
    "Mail": "ML_",
    "Event": "EV_",
    "Backup": "BC_",
    "Message": "MS_",
}

# Fields that reference User entities (need US_ prefix)
USER_REF_FIELDS = {"owner", "referrer"}
# Fields that reference Guild entities (need GU_ prefix)
GUILD_REF_FIELDS = {"guild"}
# Fields that are lists of User IDs
USER_LIST_FIELDS = {"friends"}

# code_list slots above this are character IDs needing CH_ prefix
MAX_GENERIC_SLOT = 100


# ==================== Pickle Helpers ====================

class GG:
    pass


class MockUnpickler(pickle.Unpickler):
    def find_class(self, module, name):
        if name == "GG":
            return GG
        if module in ("cgi", "config"):
            return GG
        try:
            return super().find_class(module, name)
        except Exception:
            return GG


def gg_to_dict(obj):
    """Recursively convert GG objects to plain dicts."""
    if isinstance(obj, GG):
        return gg_to_dict(obj.__dict__)
    if isinstance(obj, dict):
        return {str(k): gg_to_dict(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [gg_to_dict(v) for v in obj]
    if isinstance(obj, bytes):
        try:
            return obj.decode("utf-8")
        except Exception:
            return None
    if isinstance(obj, int) and (obj > 2**63 - 1 or obj < -(2**63)):
        return str(obj)
    return obj


def safe_unpickle(blob):
    """Try multiple strategies to unpickle a blob."""
    for enc in [None, "latin-1", "bytes"]:
        try:
            kwargs = {"encoding": enc} if enc else {}
            return gg_to_dict(MockUnpickler(io.BytesIO(blob), **kwargs).load())
        except Exception:
            pass
    return None


# ==================== Conversion ====================

def normalize_datetime(val):
    """Convert Datastore DatetimeWithNanoseconds to plain datetime."""
    if hasattr(val, "timestamp"):
        return datetime.datetime.fromtimestamp(val.timestamp(), tz=datetime.timezone.utc).replace(tzinfo=None)
    return val


def convert_value(key, val):
    """Convert a single Datastore property value to MongoDB format."""
    if val is None:
        return None
    if hasattr(val, "timestamp"):
        return normalize_datetime(val)
    if isinstance(val, bytes):
        return safe_unpickle(val)
    return val


def prefix_id(val, prefix):
    """Prefix a numeric ID if not already prefixed."""
    if val is None:
        return None
    s = str(val)
    if s.startswith(prefix):
        return s
    return prefix + s


def prefix_user_id(val):
    return prefix_id(val, "US_")


def prefix_char_id(val):
    return prefix_id(val, "CH_")


def prefix_guild_id(val):
    return prefix_id(val, "GU_")


def ds_entity_to_mongo(entity, kind):
    """Convert a Datastore entity to a MongoDB document with proper prefixes."""
    eid = entity.key.id or entity.key.name
    prefix = PREFIX.get(kind, "")
    doc = {"_id": prefix + str(eid)}

    skip_props = {"has_scatter", "__scatter__"}

    for key, val in entity.items():
        if key in skip_props:
            continue

        # Reference fields → US_ prefix (handle repeated/list values like Mail.owner)
        if key in USER_REF_FIELDS:
            if isinstance(val, list):
                doc[key] = [prefix_user_id(v) for v in val if v]
            else:
                doc[key] = prefix_user_id(val) if val else None
            continue

        # Guild field → GU_ prefix
        if key in GUILD_REF_FIELDS:
            doc[key] = prefix_guild_id(val) if val else None
            continue

        # Friends → list of US_ prefixed IDs
        if key in USER_LIST_FIELDS:
            if isinstance(val, list):
                doc[key] = [prefix_user_id(fid) for fid in val if fid]
            elif val:
                doc[key] = [prefix_user_id(val)]
            else:
                doc[key] = []
            continue

        # Email (repeated in Datastore → string in MongoDB)
        if key == "email":
            if isinstance(val, list):
                doc[key] = val[0] if val else ""
            else:
                doc[key] = val
            continue

        # General conversion
        doc[key] = convert_value(key, val)

    # Ensure friends array exists for User and Character
    if kind in ("User", "Character") and "friends" not in doc:
        doc["friends"] = []

    # Ensure info dict exists
    if "info" not in doc:
        doc["info"] = {}

    # Prefix IDs inside info
    fix_info_ids(doc.get("info", {}))

    return doc


def fix_info_ids(info):
    """Prefix numeric IDs inside info dict."""
    # info.characters[].id → CH_ prefix, info.characters[].server → SR_ prefix
    for ch in info.get("characters", []):
        if isinstance(ch, dict) and "id" in ch:
            cid = str(ch["id"])
            if cid and not cid.startswith("CH_"):
                ch["id"] = "CH_" + cid
        if isinstance(ch, dict) and "server" in ch:
            srv = str(ch["server"])
            if srv and not srv.startswith("SR_"):
                ch["server"] = "SR_" + srv

    # info.code_list slot keys: large numbers → CH_ prefix
    code_list = info.get("code_list")
    if isinstance(code_list, dict):
        new_code_list = {}
        for slot, val in code_list.items():
            new_slot = slot
            try:
                if int(slot) > MAX_GENERIC_SLOT:
                    new_slot = "CH_" + slot
            except (ValueError, TypeError):
                pass
            new_code_list[new_slot] = val
        info["code_list"] = new_code_list


def ds_infoelement_to_mongo(entity):
    """Convert a Datastore InfoElement to a MongoDB document."""
    key_name = entity.key.name or str(entity.key.id)
    doc = {"_id": "IE_" + key_name}

    for key, val in entity.items():
        if key in ("has_scatter", "__scatter__"):
            continue
        doc[key] = convert_value(key, val)

    if "info" not in doc or not isinstance(doc.get("info"), dict):
        doc["info"] = {}

    return doc


# ==================== Upsert Helper ====================

def upsert(db, collection, doc, label=""):
    """Upsert a document into MongoDB."""
    if not DRY_RUN:
        db[collection].replace_one({"_id": doc["_id"]}, doc, upsert=True)
        print(f"  [OK] {label or doc['_id']}")
    else:
        print(f"  [DRY] {label or doc['_id']}")


# ==================== Main Import ====================

def import_user(ds, db, email):
    """Import a user and ALL related entities from Datastore into MongoDB."""

    # ─── 1. Find User ───
    print(f"=== Looking up user: {email} ===\n")
    query = ds.query(kind="User")
    query.add_filter(filter=datastore.query.PropertyFilter("email", "=", email))
    users = list(query.fetch(limit=1))

    if not users:
        print("User not found in Datastore!")
        sys.exit(1)

    user_entity = users[0]
    ds_user_id = str(user_entity.key.id)
    mongo_user_id = "US_" + ds_user_id
    print(f"Datastore ID: {ds_user_id} → MongoDB ID: {mongo_user_id}\n")

    # ─── 2. Import User ───
    print("--- User ---")
    user_doc = ds_entity_to_mongo(user_entity, "User")
    for k, v in sorted(user_doc.items()):
        if k == "password":
            print(f"  {k}: {'(set)' if v else '(empty)'}")
        elif k == "info":
            print(f"  info keys: {sorted(v.keys())}")
        else:
            r = repr(v)
            if len(r) > 120:
                r = r[:120] + "..."
            print(f"  {k}: {r}")
    upsert(db, "user", user_doc, f"user {mongo_user_id}")

    # ─── 3. Import Characters ───
    print(f"\n--- Characters (owner={ds_user_id}) ---")
    query = ds.query(kind="Character")
    query.add_filter(filter=datastore.query.PropertyFilter("owner", "=", ds_user_id))
    characters = list(query.fetch())
    # Also try with string owner (some entities store it differently)
    if not characters:
        query = ds.query(kind="Character")
        query.add_filter(filter=datastore.query.PropertyFilter("owner", "=", int(ds_user_id)))
        characters = list(query.fetch())
    print(f"Found {len(characters)} characters")

    char_docs = []
    for ch in characters:
        doc = ds_entity_to_mongo(ch, "Character")
        char_docs.append(doc)
        name = doc.get("info", {}).get("name", doc.get("name", "?"))
        level = doc.get("info", {}).get("level", doc.get("level", "?"))
        print(f"  {doc['_id']}: {name} (level {level})")
        upsert(db, "character", doc, f"character {doc['_id']}")

    # ─── 4. Import Pets ───
    print(f"\n--- Pets (owner={ds_user_id}) ---")
    query = ds.query(kind="Pet")
    query.add_filter(filter=datastore.query.PropertyFilter("owner", "=", ds_user_id))
    pets = list(query.fetch())
    print(f"Found {len(pets)} pets")

    for pet in pets:
        doc = ds_entity_to_mongo(pet, "Pet")
        name = doc.get("info", {}).get("name", doc.get("name", "?"))
        print(f"  {doc['_id']}: {name}")
        upsert(db, "pet", doc, f"pet {doc['_id']}")

    # ─── 5. Import UserData (InfoElement userdata-{id}) ───
    print(f"\n--- UserData (InfoElement) ---")
    userdata_ds_key = f"userdata-{ds_user_id}"
    key = ds.key("InfoElement", userdata_ds_key)
    userdata_entity = ds.get(key)

    if userdata_entity:
        doc = ds_infoelement_to_mongo(userdata_entity)
        # Fix the key: must be IE_userdata-US_{id} for runtime
        doc["_id"] = f"IE_userdata-{mongo_user_id}"
        # Fix code_list slot keys
        fix_info_ids(doc.get("info", {}))

        code_list = doc.get("info", {}).get("code_list", {})
        print(f"  {doc['_id']}: {len(code_list)} code slots")
        if code_list:
            for slot, val in sorted(code_list.items(), key=lambda x: str(x[0])):
                print(f"    slot {slot}: {val}")
        upsert(db, "infoelement", doc, f"userdata {doc['_id']}")
    else:
        print(f"  No userdata found (key: {userdata_ds_key})")
        code_list = {}

    # ─── 6. Import USERCODEs ───
    print(f"\n--- USERCODEs (InfoElement) ---")
    usercode_count = 0

    # Fetch all code slots from code_list — the slots tell us which USERCODEs exist
    # Also scan Datastore for any USERCODE-{ds_user_id}-* entities
    all_slots = set()
    if code_list:
        all_slots.update(code_list.keys())

    # Query all USERCODE entities for this user from Datastore
    # code_list slots are already CH_ prefixed (by fix_info_ids). Strip to get
    # the bare numeric ID that Datastore uses, and track seen DS keys to avoid dupes.
    seen_ds_keys = set()
    for slot in sorted(all_slots, key=str):
        # Datastore stores bare numeric slot IDs (no CH_ prefix)
        bare_slot = slot[3:] if slot.startswith("CH_") else slot
        ds_key_name = f"USERCODE-{ds_user_id}-{bare_slot}"

        if ds_key_name in seen_ds_keys:
            continue
        seen_ds_keys.add(ds_key_name)

        key = ds.key("InfoElement", ds_key_name)
        entity = ds.get(key)

        if entity:
            doc = ds_infoelement_to_mongo(entity)
            # Fix key: IE_USERCODE-US_{user_id}-{slot}
            # slot should be CH_ prefixed if it's a character ID
            mongo_slot = bare_slot
            try:
                if int(mongo_slot) > MAX_GENERIC_SLOT:
                    mongo_slot = "CH_" + mongo_slot
            except (ValueError, TypeError):
                pass
            doc["_id"] = f"IE_USERCODE-{mongo_user_id}-{mongo_slot}"
            code_preview = str(doc.get("info", {}).get("code", ""))[:60]
            print(f"  {doc['_id']}: {code_preview!r}...")
            upsert(db, "infoelement", doc, f"usercode {doc['_id']}")
            usercode_count += 1

    print(f"  Total: {usercode_count} USERCODE entities")

    # ─── 7. Import Marks ───
    print(f"\n--- Marks ---")
    mark_count = 0

    # Email mark
    email_val = user_doc.get("email", email)
    mark_doc = {
        "_id": f"MK_email-{email_val}",
        "type": "email",
        "phrase": email_val,
        "owner": mongo_user_id,
        "created": user_doc.get("created", datetime.datetime.utcnow()),
    }
    print(f"  {mark_doc['_id']}")
    upsert(db, "mark", mark_doc, f"mark {mark_doc['_id']}")
    mark_count += 1

    # Character name marks
    for ch_doc in char_docs:
        ch_name = ch_doc.get("info", {}).get("name") or ch_doc.get("name")
        if ch_name:
            simplified = ch_name.lower()
            mark_doc = {
                "_id": f"MK_character-{simplified}",
                "type": "character",
                "phrase": simplified,
                "owner": ch_doc["_id"],  # owner is the character ID
                "created": ch_doc.get("created", datetime.datetime.utcnow()),
            }
            print(f"  {mark_doc['_id']} (for {ch_name})")
            upsert(db, "mark", mark_doc, f"mark {mark_doc['_id']}")
            mark_count += 1

    print(f"  Total: {mark_count} marks")

    # ─── 8. Import Mail (latest MAIL_LIMIT only for testing) ───
    MAIL_LIMIT = int(os.environ.get("MAIL_LIMIT", "100"))
    print(f"\n--- Mail (limit={MAIL_LIMIT}) ---")
    query = ds.query(kind="Mail")
    query.add_filter(filter=datastore.query.PropertyFilter("owner", "=", ds_user_id))
    all_mails = list(query.fetch())
    # Sort by key ID descending to get latest first, then take limit
    all_mails.sort(key=lambda e: (e.key.id or 0), reverse=True)
    mails = all_mails[:MAIL_LIMIT]
    print(f"Found {len(all_mails)} total, importing {len(mails)}")

    for mail_entity in mails:
        doc = ds_entity_to_mongo(mail_entity, "Mail")
        subj = doc.get("info", {}).get("subject", "?")
        print(f"  {doc['_id']}: {subj}")
        upsert(db, "mail", doc, f"mail {doc['_id']}")

    # ─── 9. Backups (skipped for now — enable with IMPORT_BACKUPS=1) ───
    backups = []
    if os.environ.get("IMPORT_BACKUPS", "0") == "1":
        print(f"\n--- Backups ---")
        query = ds.query(kind="Backup")
        query.add_filter(
            filter=datastore.query.PropertyFilter("backup_item_id", "=", f"user|{ds_user_id}")
        )
        backups = list(query.fetch())

        # Also get character backups
        for ch in characters:
            ch_id = str(ch.key.id or ch.key.name)
            query = ds.query(kind="Backup")
            query.add_filter(
                filter=datastore.query.PropertyFilter("backup_item_id", "=", f"character|{ch_id}")
            )
            backups.extend(list(query.fetch()))

        print(f"Found {len(backups)} backups (user + characters)")

        for backup in backups:
            eid = backup.key.id or backup.key.name
            doc = {"_id": "BC_" + str(eid)}

            for key, val in backup.items():
                if key in ("has_scatter", "__scatter__"):
                    continue
                if key == "backup_item_id" and val:
                    parts = val.split("|", 1)
                    if len(parts) == 2:
                        if parts[0] == "user":
                            doc[key] = f"user|{prefix_user_id(parts[1])}"
                        elif parts[0] == "character":
                            doc[key] = f"character|{prefix_char_id(parts[1])}"
                        else:
                            doc[key] = val
                    else:
                        doc[key] = val
                elif key in USER_REF_FIELDS:
                    doc[key] = prefix_user_id(val) if val else None
                elif key in GUILD_REF_FIELDS:
                    doc[key] = prefix_guild_id(val) if val else None
                elif key in USER_LIST_FIELDS:
                    if isinstance(val, list):
                        doc[key] = [prefix_user_id(fid) for fid in val if fid]
                    else:
                        doc[key] = [prefix_user_id(val)] if val else []
                elif key == "email":
                    doc[key] = val[0] if isinstance(val, list) and val else val
                else:
                    doc[key] = convert_value(key, val)

            if "info" not in doc:
                doc["info"] = {}
            if isinstance(doc.get("info"), dict):
                fix_info_ids(doc["info"])

            bid = doc.get("backup_item_id", "?")
            print(f"  {doc['_id']}: {bid}")
            upsert(db, "backup", doc, f"backup {doc['_id']}")
    else:
        print(f"\n--- Backups (skipped — set IMPORT_BACKUPS=1 to include) ---")

    # ─── Summary ───
    print(f"\n{'=' * 50}")
    print(f"{'[DRY RUN] ' if DRY_RUN else ''}Import summary for {email}:")
    print(f"  User:       {mongo_user_id}")
    print(f"  Characters: {len(char_docs)}")
    print(f"  Pets:       {len(pets)}")
    print(f"  UserData:   {'yes' if userdata_entity else 'no'} ({len(code_list)} code slots)")
    print(f"  USERCODEs:  {usercode_count}")
    print(f"  Marks:      {mark_count}")
    print(f"  Mail:       {len(mails)}/{len(all_mails)}")
    print(f"  Backups:    {len(backups)}")
    print(f"{'=' * 50}")


def main():
    if len(sys.argv) < 2:
        print("Usage: python import_from_datastore.py <email>")
        print("       DRY_RUN=1 python import_from_datastore.py <email>")
        sys.exit(1)

    email = sys.argv[1]

    if DRY_RUN:
        print("=== DRY RUN MODE ===\n")

    ds = datastore.Client(project="twodimensionalgame")
    mongo = MongoClient(MONGO_URI)[MONGO_DB]

    import_user(ds, mongo, email)

    print("\nDone!")


if __name__ == "__main__":
    main()
