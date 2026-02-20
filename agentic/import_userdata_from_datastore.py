#!/usr/bin/env python3
"""
Re-import InfoElement userdata entities from Google Datastore into MongoDB.
Fixes code_list corruption from the RDBMS migration.

Key mapping issue:
  - Datastore key: userdata-{numeric_id}        e.g. userdata-5752754626625536
  - RDBMS key:     IE_userdata-{numeric_id}      e.g. IE_userdata-5818821692620800
  - Runtime expects: IE_userdata-{mongo_user_id}  e.g. IE_userdata-US_5818821692620800

  The runtime does: get("IE_userdata-" + user._id) where user._id = "US_xxx"
  So we must map Datastore user IDs to MongoDB user IDs (by email match).

Usage:
  python import_userdata_from_datastore.py                     # all userdata
  python import_userdata_from_datastore.py kaansoral@gmail.com  # single user
  DRY_RUN=1 python import_userdata_from_datastore.py           # preview only
"""

import os
import sys
import pickle
import io
import datetime

from google.cloud import datastore
from pymongo import MongoClient

os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "..", "secretsandconfig", "twodimensionalgame_datastore_reader.json",
)

from mongo_config import MONGO_URI, MONGO_DB

DRY_RUN = os.environ.get("DRY_RUN", "0") == "1"


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
    for enc in [None, "latin-1", "bytes"]:
        try:
            kwargs = {"encoding": enc} if enc else {}
            return gg_to_dict(MockUnpickler(io.BytesIO(blob), **kwargs).load())
        except Exception:
            pass
    return None


def normalize_datetime(val):
    if hasattr(val, "timestamp"):
        return datetime.datetime.fromtimestamp(val.timestamp(), tz=datetime.timezone.utc).replace(tzinfo=None)
    return val


def convert_value(val):
    if val is None:
        return None
    if hasattr(val, "timestamp"):
        return normalize_datetime(val)
    if isinstance(val, bytes):
        return safe_unpickle(val)
    return val


def ds_entity_to_doc(entity):
    """Convert a Datastore entity to a plain dict (no _id yet)."""
    doc = {}
    for prop_key, val in entity.items():
        if prop_key in ("has_scatter", "__scatter__"):
            continue
        doc[prop_key] = convert_value(val)
    if "info" not in doc or not isinstance(doc.get("info"), dict):
        doc["info"] = {}
    return doc


# ==================== ID Mapping ====================

def build_email_to_mongo_id(db):
    """Build a mapping from email → MongoDB user _id."""
    print("Building email → MongoDB user ID mapping...")
    mapping = {}
    for user in db.user.find({}, {"_id": 1, "email": 1, "info.email": 1}):
        uid = user["_id"]
        # Top-level email (string or list)
        email = user.get("email")
        if isinstance(email, list):
            for e in email:
                if e:
                    mapping[e.lower()] = uid
        elif email:
            mapping[email.lower()] = uid
        # info.email
        info_email = user.get("info", {}).get("email")
        if info_email and isinstance(info_email, str):
            mapping[info_email.lower()] = uid
    print(f"  Mapped {len(mapping)} emails to MongoDB user IDs")
    return mapping


def find_mongo_user_id(ds, db, ds_user_id, email_map):
    """Find the MongoDB user _id for a Datastore user ID."""
    # Strategy 1: Check if US_{ds_id} exists directly in MongoDB
    direct_id = f"US_{ds_user_id}"
    if db.user.find_one({"_id": direct_id}, {"_id": 1}):
        return direct_id

    # Strategy 2: Look up the Datastore user's email, then find in MongoDB
    key = ds.key("User", int(ds_user_id))
    ds_user = ds.get(key)
    if ds_user:
        # Try email field
        email = ds_user.get("email")
        if isinstance(email, list):
            email = email[0] if email else None
        if email:
            mongo_id = email_map.get(email.lower())
            if mongo_id:
                return mongo_id

        # Try info.email
        info = ds_user.get("info")
        if isinstance(info, bytes):
            info = safe_unpickle(info)
        if isinstance(info, dict):
            info_email = info.get("email")
            if info_email:
                mongo_id = email_map.get(info_email.lower())
                if mongo_id:
                    return mongo_id

    return None


# ==================== Main ====================

def import_single_user(ds, db, email):
    """Import userdata for a single user by email."""
    print(f"Looking up user: {email}")
    query = ds.query(kind="User")
    query.add_filter(filter=datastore.query.PropertyFilter("email", "=", email))
    users = list(query.fetch(limit=1))

    if not users:
        print("User not found in Datastore!")
        return

    user = users[0]
    ds_user_id = str(user.key.id)
    print(f"Datastore User ID: {ds_user_id}")

    # Find corresponding MongoDB user
    mongo_user = db.user.find_one({"email": email}, {"_id": 1})
    if not mongo_user:
        mongo_user = db.user.find_one({"info.email": email}, {"_id": 1})
    if not mongo_user:
        # Try direct ID
        mongo_user = db.user.find_one({"_id": f"US_{ds_user_id}"}, {"_id": 1})

    if mongo_user:
        mongo_user_id = mongo_user["_id"]
        print(f"MongoDB User ID: {mongo_user_id}")
    else:
        print("WARNING: User not found in MongoDB! Using DS ID with US_ prefix")
        mongo_user_id = f"US_{ds_user_id}"

    # Fetch userdata from Datastore
    userdata_key = f"userdata-{ds_user_id}"
    key = ds.key("InfoElement", userdata_key)
    entity = ds.get(key)

    if not entity:
        print(f"  InfoElement {userdata_key}: NOT FOUND in Datastore")
        return

    doc = ds_entity_to_doc(entity)
    target_id = f"IE_userdata-{mongo_user_id}"
    doc["_id"] = target_id

    info = doc.get("info", {})
    code_list = info.get("code_list", {})
    code_count = len(code_list) if isinstance(code_list, dict) else 0

    print(f"  Target: {target_id} ({code_count} code slots)")

    if not DRY_RUN:
        db.infoelement.replace_one({"_id": target_id}, doc, upsert=True)
        print(f"  Upserted!")
    else:
        print(f"  [DRY RUN] Would upsert")
        if isinstance(code_list, dict):
            for slot, val in sorted(code_list.items(), key=lambda x: str(x[0])):
                print(f"    slot {slot}: {val}")


def import_all_userdata(ds, db):
    """Import all userdata InfoElements from Datastore."""
    email_map = build_email_to_mongo_id(db)

    print("\nQuerying all InfoElement entities from Datastore...\n")
    query = ds.query(kind="InfoElement")

    imported = 0
    skipped = 0
    unmapped = 0

    for entity in query.fetch():
        key_name = entity.key.name
        if not key_name or not key_name.startswith("userdata-"):
            skipped += 1
            continue

        ds_user_id = key_name.replace("userdata-", "")
        mongo_user_id = find_mongo_user_id(ds, db, ds_user_id, email_map)

        if not mongo_user_id:
            unmapped += 1
            continue

        doc = ds_entity_to_doc(entity)
        target_id = f"IE_userdata-{mongo_user_id}"
        doc["_id"] = target_id

        if not DRY_RUN:
            db.infoelement.replace_one({"_id": target_id}, doc, upsert=True)

        imported += 1
        if imported % 100 == 0:
            print(f"  Imported {imported} userdata docs...", flush=True)

    print(f"\nImported {imported} userdata InfoElements")
    print(f"Skipped {skipped} non-userdata, {unmapped} unmapped (no MongoDB user found)")


def main():
    if DRY_RUN:
        print("=== DRY RUN MODE ===\n")

    ds = datastore.Client(project="twodimensionalgame")
    db = MongoClient(MONGO_URI)[MONGO_DB]

    if len(sys.argv) > 1:
        email = sys.argv[1]
        import_single_user(ds, db, email)
    else:
        import_all_userdata(ds, db)

    print("\nDone!")


if __name__ == "__main__":
    main()
