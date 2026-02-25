#!/usr/bin/env python3
"""
Audit MongoDB collections for unprefixed IDs.

Checks all collections in the adventuredev database for IDs and references
that should be prefixed (US_, CH_, GU_, SR_, PT_, ML_, MS_, IE_, etc.)
but are not.
"""

import sys
import os
import re
from collections import defaultdict
from pymongo import MongoClient

# Use shared config if env vars set, otherwise fall back to remote dev server
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if os.environ.get("MONGO_URI"):
    from mongo_config import MONGO_URI, MONGO_DB
    DB_NAME = MONGO_DB
else:
    # Read connection details from keys.js-equivalent config
    from urllib.parse import quote_plus
    _user = "adv_dev"
    _pass = quote_plus("qLIgjpy+OISv5yLhx+AJDgZSeur46nMk")
    _host = "195.201.105.60"
    _port = "42088"
    _ca = "/Users/kaan/Desktop/PROJECTS/thegame/thegame_mongodb/secretsandconfig/dev-w1-ca.crt"
    DB_NAME = "adventuredev"
    MONGO_URI = (
        f"mongodb://{_user}:{_pass}@{_host}:{_port}/{DB_NAME}"
        f"?authSource={DB_NAME}&tls=true&tlsCAFile={_ca}"
    )

# Expected prefixes per collection (supports both singular and plural names)
EXPECTED_PREFIX = {
    "user": "US_", "users": "US_",
    "character": "CH_", "characters": "CH_",
    "guild": "GU_", "guilds": "GU_",
    "server": "SR_", "servers": "SR_",
    "pet": "PT_", "pets": "PT_",
    "message": "MS_", "messages": "MS_",
    "mail": "ML_",
    "event": "EV_", "events": "EV_",
    "infoelement": "IE_", "infoelements": "IE_",
    "upload": "UL_", "uploads": "UL_",
    "ip": "IP_", "ips": "IP_",
    "mark": "MK_", "marks": "MK_",
    "backup": "BC_", "backups": "BC_",
    "map": "MP_", "maps": "MP_",
}


def connect():
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    return client, db


def report_issue(collection, field, examples, count, total=None):
    prefix = f"  [{collection}.{field}]"
    if total is not None:
        print(f"{prefix} {count}/{total} documents have unprefixed values")
    else:
        print(f"{prefix} {count} documents have unprefixed values")
    for ex in examples[:5]:
        print(f"    Example: {ex}")
    print()


def check_id_prefix(db, collection_name, expected_prefix):
    """Check that _id values have the expected prefix."""
    coll = db[collection_name]
    total = coll.count_documents({})
    if total == 0:
        print(f"  [{collection_name}._id] Collection is empty, skipping")
        return

    # Find docs whose _id does NOT start with the expected prefix
    # _id could be string or other type
    unprefixed = list(coll.find(
        {"_id": {"$not": {"$regex": f"^{re.escape(expected_prefix)}"}}},
        {"_id": 1}
    ).limit(10))

    unprefixed_count = coll.count_documents(
        {"_id": {"$not": {"$regex": f"^{re.escape(expected_prefix)}"}}}
    )

    if unprefixed_count > 0:
        examples = [str(doc["_id"]) for doc in unprefixed]
        report_issue(collection_name, "_id", examples, unprefixed_count, total)
    else:
        print(f"  [{collection_name}._id] OK - all {total} documents have {expected_prefix} prefix")


def check_field_prefix(db, collection_name, field_path, expected_prefix, is_array=False):
    """Check that a field has the expected prefix."""
    coll = db[collection_name]

    if is_array:
        # For array fields, find docs where any element doesn't match
        # First check docs that have the field and it's non-empty
        pipeline = [
            {"$match": {field_path: {"$exists": True, "$ne": None, "$ne": [], "$ne": ""}}},
            {"$project": {
                field_path: 1,
                "_id": 1
            }}
        ]
        docs_with_field = list(coll.aggregate(pipeline))

        bad_docs = []
        for doc in docs_with_field:
            # Navigate to the field
            val = doc
            for part in field_path.split("."):
                if isinstance(val, dict):
                    val = val.get(part)
                else:
                    val = None
                    break

            if val is None:
                continue

            if isinstance(val, list):
                for item in val:
                    if isinstance(item, str) and not item.startswith(expected_prefix):
                        bad_docs.append({"_id": doc["_id"], "value": item})
                        break
            elif isinstance(val, str) and not val.startswith(expected_prefix):
                bad_docs.append({"_id": doc["_id"], "value": val})

        if bad_docs:
            examples = [f"_id={d['_id']}, {field_path}={d['value']}" for d in bad_docs[:5]]
            report_issue(collection_name, field_path, examples, len(bad_docs), len(docs_with_field))
        else:
            print(f"  [{collection_name}.{field_path}] OK - all values have {expected_prefix} prefix (checked {len(docs_with_field)} docs)")

    else:
        # For scalar fields
        total_with_field = coll.count_documents({
            field_path: {"$exists": True, "$ne": None, "$ne": ""}
        })
        if total_with_field == 0:
            print(f"  [{collection_name}.{field_path}] No documents have this field set")
            return

        unprefixed = list(coll.find(
            {
                field_path: {
                    "$exists": True,
                    "$ne": None,
                    "$ne": "",
                    "$not": {"$regex": f"^{re.escape(expected_prefix)}"}
                }
            },
            {"_id": 1, field_path: 1}
        ).limit(10))

        unprefixed_count = coll.count_documents({
            field_path: {
                "$exists": True,
                "$ne": None,
                "$ne": "",
                "$not": {"$regex": f"^{re.escape(expected_prefix)}"}
            }
        })

        if unprefixed_count > 0:
            examples = []
            for doc in unprefixed:
                val = doc
                for part in field_path.split("."):
                    if isinstance(val, dict):
                        val = val.get(part)
                    else:
                        val = None
                        break
                examples.append(f"_id={doc['_id']}, {field_path}={val}")
            report_issue(collection_name, field_path, examples, unprefixed_count, total_with_field)
        else:
            print(f"  [{collection_name}.{field_path}] OK - all {total_with_field} values have {expected_prefix} prefix")


def check_nested_array_field(db, collection_name, array_path, nested_field, expected_prefix):
    """Check a field inside array elements (e.g., info.characters[].id)."""
    coll = db[collection_name]

    docs = list(coll.find(
        {array_path: {"$exists": True, "$ne": None, "$ne": []}},
        {"_id": 1, array_path: 1}
    ))

    if not docs:
        print(f"  [{collection_name}.{array_path}[].{nested_field}] No documents have {array_path}")
        return

    bad_docs = []
    for doc in docs:
        arr = doc
        for part in array_path.split("."):
            if isinstance(arr, dict):
                arr = arr.get(part)
            else:
                arr = None
                break

        if not isinstance(arr, list):
            continue

        for item in arr:
            if isinstance(item, dict) and nested_field in item:
                val = item[nested_field]
                if isinstance(val, str) and not val.startswith(expected_prefix):
                    bad_docs.append({"_id": doc["_id"], "value": val})
                    break
                elif isinstance(val, (int, float)):
                    bad_docs.append({"_id": doc["_id"], "value": val})
                    break

    if bad_docs:
        examples = [f"_id={d['_id']}, {array_path}[].{nested_field}={d['value']}" for d in bad_docs[:5]]
        report_issue(collection_name, f"{array_path}[].{nested_field}", examples, len(bad_docs), len(docs))
    else:
        print(f"  [{collection_name}.{array_path}[].{nested_field}] OK - all {len(docs)} docs have {expected_prefix} prefix")


def check_guild_members(db, guild_coll_name=None):
    """Check guild member IDs - they can be nested in info or a members field."""
    if guild_coll_name is None:
        for name in ["guild", "guilds"]:
            if name in db.list_collection_names():
                guild_coll_name = name
                break
    if guild_coll_name is None:
        print("  [guilds.members] No guild collection found")
        return
    coll = db[guild_coll_name]
    docs = list(coll.find({}, {"_id": 1, "info": 1, "members": 1}))

    if not docs:
        print("  [guilds.members] Collection is empty")
        return

    bad_docs = []
    checked = 0
    for doc in docs:
        # Check info.members if it exists
        info = doc.get("info", {})
        if isinstance(info, dict):
            members = info.get("members")
            if isinstance(members, (list, dict)):
                checked += 1
                if isinstance(members, dict):
                    for k, v in members.items():
                        if isinstance(v, dict):
                            member_id = v.get("id") or k
                        else:
                            member_id = k
                        if isinstance(member_id, str) and not member_id.startswith("US_"):
                            bad_docs.append({"_id": doc["_id"], "value": member_id})
                            break
                        elif isinstance(member_id, (int, float)):
                            bad_docs.append({"_id": doc["_id"], "value": member_id})
                            break
                elif isinstance(members, list):
                    for m in members:
                        mid = m if isinstance(m, str) else (m.get("id") if isinstance(m, dict) else str(m))
                        if isinstance(mid, str) and not mid.startswith("US_"):
                            bad_docs.append({"_id": doc["_id"], "value": mid})
                            break

        # Also check top-level members field
        members = doc.get("members")
        if isinstance(members, (list, dict)) and not isinstance(info.get("members"), (list, dict)):
            checked += 1
            # similar check
            pass

    if bad_docs:
        examples = [f"_id={d['_id']}, member={d['value']}" for d in bad_docs[:5]]
        report_issue(guild_coll_name, "members", examples, len(bad_docs), checked)
    else:
        print(f"  [{guild_coll_name}.members] OK - checked {checked} docs with members")


def find_coll(collections, *names):
    """Find the first matching collection name from a list of candidates."""
    for n in names:
        if n in collections:
            return n
    return None


def audit_infoelements(db, ie_coll):
    """Deep audit of infoelement _id patterns."""
    coll = db[ie_coll]
    total = coll.count_documents({})
    print(f"  Total documents: {total}")

    # Sample some _id values to understand patterns
    samples = list(coll.find({}, {"_id": 1}).limit(20))
    print(f"  Sample _id values:")
    for s in samples:
        print(f"    {s['_id']}")

    # Check for userdata entries without proper US_ prefix in the embedded user ID
    # Expected: IE_userdata-US_xxx
    all_userdata = list(coll.find(
        {"_id": {"$regex": "^IE_userdata-"}},
        {"_id": 1}
    ))
    bad_userdata = [d["_id"] for d in all_userdata
                    if not d["_id"][len("IE_userdata-"):].startswith("US_")]
    total_userdata = len(all_userdata)
    if bad_userdata:
        report_issue(ie_coll, "_id (userdata missing US_ prefix)", bad_userdata[:5], len(bad_userdata), total_userdata)
    else:
        print(f"  [{ie_coll}._id (userdata)] OK - all {total_userdata} userdata entries have US_ prefix")

    # Check for USERCODE entries
    all_usercode = list(coll.find(
        {"_id": {"$regex": "^IE_USERCODE-"}},
        {"_id": 1}
    ))
    bad_usercode = [d["_id"] for d in all_usercode
                    if not d["_id"][len("IE_USERCODE-"):].startswith("US_")]
    if bad_usercode:
        report_issue(ie_coll, "_id (USERCODE missing US_ prefix)", bad_usercode[:5], len(bad_usercode), len(all_usercode))
    else:
        print(f"  [{ie_coll}._id (USERCODE)] OK - all {len(all_usercode)} USERCODE entries have US_ prefix")

    # Check for NaN in _id (leftover from parseInt bug)
    nan_docs = list(coll.find({"_id": {"$regex": "NaN"}}, {"_id": 1}).limit(10))
    nan_count = coll.count_documents({"_id": {"$regex": "NaN"}})
    if nan_count > 0:
        examples = [d["_id"] for d in nan_docs]
        report_issue(ie_coll, "_id (contains NaN)", examples, nan_count, total)
    else:
        print(f"  [{ie_coll}._id (NaN)] OK - no NaN entries found")

    # Check for any _id that doesn't start with IE_
    non_ie = list(coll.find(
        {"_id": {"$not": {"$regex": "^IE_"}}},
        {"_id": 1}
    ).limit(10))
    non_ie_count = coll.count_documents({"_id": {"$not": {"$regex": "^IE_"}}})
    if non_ie_count > 0:
        examples = [str(d["_id"]) for d in non_ie]
        report_issue(ie_coll, "_id (non-IE_ prefix)", examples, non_ie_count, total)
    else:
        print(f"  [{ie_coll}._id] OK - all {total} documents have IE_ prefix")


def main():
    print("=" * 70)
    print("MongoDB Unprefixed ID Audit")
    print("=" * 70)

    client, db = connect()
    print(f"\nConnected to {DB_NAME}")

    # List all collections
    collections = sorted(db.list_collection_names())
    print(f"Collections: {collections}\n")

    # ===== 1. SERVERS =====
    print("--- SERVERS ---")
    srv = find_coll(collections, "server", "servers")
    if srv:
        check_id_prefix(db, srv, "SR_")
    else:
        print("  No server collection found")
    print()

    # ===== 2. CHARACTERS =====
    print("--- CHARACTERS ---")
    ch = find_coll(collections, "character", "characters")
    if ch:
        check_id_prefix(db, ch, "CH_")
        check_field_prefix(db, ch, "owner", "US_")
        check_field_prefix(db, ch, "guild", "GU_")
        check_field_prefix(db, ch, "server", "SR_")
    else:
        print("  No character collection found")
    print()

    # ===== 3. USERS =====
    print("--- USERS ---")
    us = find_coll(collections, "user", "users")
    if us:
        check_id_prefix(db, us, "US_")
        check_field_prefix(db, us, "guild", "GU_")
        check_field_prefix(db, us, "referrer", "US_")
        check_field_prefix(db, us, "friends", "US_", is_array=True)
        check_nested_array_field(db, us, "info.characters", "id", "CH_")
        check_nested_array_field(db, us, "info.characters", "server", "SR_")
    else:
        print("  No user collection found")
    print()

    # ===== 4. GUILDS =====
    print("--- GUILDS ---")
    gu = find_coll(collections, "guild", "guilds")
    if gu:
        check_id_prefix(db, gu, "GU_")
        check_guild_members(db, gu)
    else:
        print("  No guild collection found")
    print()

    # ===== 5. PETS =====
    print("--- PETS ---")
    pt = find_coll(collections, "pet", "pets")
    if pt:
        check_id_prefix(db, pt, "PT_")
        check_field_prefix(db, pt, "owner", "US_")
    else:
        print("  No pet collection found")
    print()

    # ===== 6. MESSAGES =====
    print("--- MESSAGES ---")
    ms = find_coll(collections, "message", "messages")
    if ms:
        check_id_prefix(db, ms, "MS_")
        check_field_prefix(db, ms, "owner", "US_")
        check_field_prefix(db, ms, "sender", "US_")
        check_field_prefix(db, ms, "to", "US_")
        check_field_prefix(db, ms, "fro", "US_")
    else:
        print("  No message collection found")
    print()

    # ===== 7. MAIL =====
    print("--- MAIL ---")
    ml = find_coll(collections, "mail")
    if ml:
        check_id_prefix(db, ml, "ML_")
        check_field_prefix(db, ml, "owner", "US_")
        check_field_prefix(db, ml, "sender", "US_")
        check_field_prefix(db, ml, "to", "US_")
        check_field_prefix(db, ml, "fro", "US_")
    else:
        print("  No mail collection found")
    print()

    # ===== 8. EVENTS =====
    print("--- EVENTS ---")
    ev = find_coll(collections, "event", "events")
    if ev:
        check_id_prefix(db, ev, "EV_")
    else:
        print("  No event collection found")
    print()

    # ===== 9. INFOELEMENTS =====
    print("--- INFOELEMENTS ---")
    ie = find_coll(collections, "infoelement", "infoelements")
    if ie:
        audit_infoelements(db, ie)
    else:
        print("  No infoelement collection found")
    print()

    # ===== 10. IPS =====
    print("--- IPS ---")
    ip = find_coll(collections, "ip", "ips")
    if ip:
        check_id_prefix(db, ip, "IP_")
        check_field_prefix(db, ip, "referrer", "US_")
        check_field_prefix(db, ip, "owner", "US_")
    else:
        print("  No ip collection found")
    print()

    # ===== 11. MARKS =====
    print("--- MARKS ---")
    mk = find_coll(collections, "mark", "marks")
    if mk:
        check_id_prefix(db, mk, "MK_")
    else:
        print("  No mark collection found")
    print()

    # ===== 12. UPLOADS =====
    print("--- UPLOADS ---")
    ul = find_coll(collections, "upload", "uploads")
    if ul:
        check_id_prefix(db, ul, "UL_")
    else:
        print("  No upload collection found")
    print()

    # ===== 13. MAPS =====
    print("--- MAPS ---")
    mp = find_coll(collections, "map", "maps")
    if mp:
        check_id_prefix(db, mp, "MP_")
    else:
        print("  No map collection found")
    print()

    # ===== 14. BACKUPS =====
    print("--- BACKUPS ---")
    bc = find_coll(collections, "backup", "backups")
    if bc:
        check_id_prefix(db, bc, "BC_")
    else:
        print("  No backup collection found")
    print()

    # ===== 15. ANY OTHER COLLECTIONS =====
    known = set(EXPECTED_PREFIX.keys())
    unknown = [c for c in collections if c not in known and not c.startswith("system.")]
    if unknown:
        print("--- OTHER / UNKNOWN COLLECTIONS ---")
        for cname in unknown:
            coll = db[cname]
            total = coll.count_documents({})
            samples = list(coll.find({}, {"_id": 1}).limit(5))
            sample_ids = [str(s["_id"]) for s in samples]
            print(f"  {cname}: {total} docs, sample _ids: {sample_ids}")

            # Check for common reference fields
            sample_full = list(coll.find({}).limit(3))
            for doc in sample_full:
                for key in ["owner", "sender", "to", "fro", "guild", "server", "referrer"]:
                    if key in doc:
                        print(f"    {cname}.{key} = {doc[key]} (in doc {doc['_id']})")
        print()

    # ===== SUMMARY: Cross-collection server references =====
    print("--- SERVER REFERENCE CROSS-CHECK ---")
    if srv:
        server_ids = [doc["_id"] for doc in db[srv].find({}, {"_id": 1})]
        print(f"  Server _ids in '{srv}': {server_ids}")

        if ch:
            char_servers = db[ch].distinct("server")
            print(f"  Distinct {ch}.server values: {char_servers}")

        if us:
            user_sample = list(db[us].find(
                {"info.characters": {"$exists": True, "$ne": None}},
                {"_id": 1, "info.characters": 1}
            ).limit(5))
            for u in user_sample:
                chars = u.get("info", {}).get("characters", [])
                if isinstance(chars, list):
                    for c in chars[:2]:
                        if isinstance(c, dict):
                            print(f"  user {u['_id']} -> info.characters[].server = {c.get('server')}, id = {c.get('id')}")
    else:
        print("  No server collection found — skipping cross-check")
    print()

    print("=" * 70)
    print("Audit complete.")
    print("=" * 70)

    client.close()


if __name__ == "__main__":
    main()
