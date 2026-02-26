#!/usr/bin/env python3
"""
Fix unprefixed server IDs in MongoDB.

Server IDs should be stored with the SR_ prefix everywhere (e.g., "SR_EUI" not "EUI").
This script fixes:
1. character.server - prefix with SR_ where missing
2. user.info.characters[].server - prefix with SR_ where missing
3. user.server (bank mount) - prefix with SR_ where non-empty and missing prefix
4. message.owner - convert ~EUI -> ~SR_EUI for server-owned messages
5. message.server - convert bare EUI -> SR_EUI
6. Delete stale IE_infoelement|userdata-5818821692620800 (malformed migration artifact)
7. ip.referrer for IP_127.0.0.1 - fix "Archer" to clear it

Usage:
  python fix_server_ids.py
  DRY_RUN=1 python fix_server_ids.py
"""

import os
import re
from pymongo import MongoClient

from mongo_config import MONGO_URI, MONGO_DB

DRY_RUN = os.environ.get("DRY_RUN", "0") == "1"


def main():
    client = MongoClient(MONGO_URI)
    db = client[MONGO_DB]

    if DRY_RUN:
        print("=== DRY RUN MODE ===\n")

    # 1. Fix character.server - prefix with SR_ where missing
    print("--- 1. Fixing character.server ---")
    chars = list(db["character"].find({
        "server": {"$exists": True, "$ne": None, "$ne": ""},
        "server": {"$not": re.compile("^SR_")}
    }))
    # More reliable: find all with server set, filter in Python
    chars = list(db["character"].find({"server": {"$exists": True, "$nin": [None, ""]}}))
    chars = [c for c in chars if not c["server"].startswith("SR_")]
    print(f"Found {len(chars)} characters with unprefixed server")
    for c in chars:
        new_val = "SR_" + c["server"]
        print(f"  {c['_id']}: {c['server']} -> {new_val}")
        if not DRY_RUN:
            db["character"].update_one({"_id": c["_id"]}, {"$set": {"server": new_val}})

    # 2. Fix user.info.characters[].server - prefix with SR_ where missing
    print("\n--- 2. Fixing user.info.characters[].server ---")
    users = list(db["user"].find({"info.characters": {"$exists": True}}))
    fix_count = 0
    for u in users:
        characters = u.get("info", {}).get("characters", [])
        if not characters:
            continue
        modified = False
        for ch in characters:
            srv = ch.get("server", "")
            if srv and not srv.startswith("SR_"):
                ch["server"] = "SR_" + srv
                modified = True
                fix_count += 1
                print(f"  user {u['_id']}, char server: {srv} -> {ch['server']}")
        if modified and not DRY_RUN:
            db["user"].update_one({"_id": u["_id"]}, {"$set": {"info.characters": characters}})
    print(f"Fixed {fix_count} character entries across users")

    # 3. Fix user.server (bank mount) - prefix with SR_ where non-empty and missing prefix
    print("\n--- 3. Fixing user.server (bank mount) ---")
    bank_users = list(db["user"].find({"server": {"$exists": True, "$nin": [None, ""]}}))
    bank_users = [u for u in bank_users if not u["server"].startswith("SR_")]
    print(f"Found {len(bank_users)} users with unprefixed server (bank mount)")
    for u in bank_users:
        new_val = "SR_" + u["server"]
        print(f"  {u['_id']}: {u['server']} -> {new_val}")
        if not DRY_RUN:
            db["user"].update_one({"_id": u["_id"]}, {"$set": {"server": new_val}})

    # 4. Fix message.owner - convert ~EUI -> ~SR_EUI for server-owned messages
    #    Skip ~global (special channel, not a server ID)
    print("\n--- 4. Fixing message.owner (server-owned) ---")
    msgs = list(db["message"].find({"owner": {"$regex": "^~(?!SR_|global$)"}}))
    print(f"Found {len(msgs)} messages with unprefixed server owner")
    for m in msgs:
        old_owner = m["owner"]
        # ~EUI -> ~SR_EUI
        new_owner = "~SR_" + old_owner[1:]
        print(f"  {m['_id']}: {old_owner} -> {new_owner}")
        if not DRY_RUN:
            db["message"].update_one({"_id": m["_id"]}, {"$set": {"owner": new_owner}})

    # 5. Fix message.server - convert bare EUI -> SR_EUI
    print("\n--- 5. Fixing message.server ---")
    msgs_srv = list(db["message"].find({"server": {"$exists": True, "$nin": [None, ""]}}))
    msgs_srv = [m for m in msgs_srv if not m["server"].startswith("SR_")]
    print(f"Found {len(msgs_srv)} messages with unprefixed server")
    for m in msgs_srv:
        new_val = "SR_" + m["server"]
        print(f"  {m['_id']}: {m['server']} -> {new_val}")
        if not DRY_RUN:
            db["message"].update_one({"_id": m["_id"]}, {"$set": {"server": new_val}})

    # 6. Delete stale malformed migration artifact
    print("\n--- 6. Deleting stale IE_infoelement|userdata-5818821692620800 ---")
    stale_id = "IE_infoelement|userdata-5818821692620800"
    stale = db["InfoElement"].find_one({"_id": stale_id})
    if stale:
        print(f"  Found and deleting: {stale_id}")
        if not DRY_RUN:
            db["InfoElement"].delete_one({"_id": stale_id})
    else:
        print("  Not found (already deleted or doesn't exist)")

    # 7. Fix ip.referrer for IP_127.0.0.1 - clear "Archer" (not a valid user ID)
    print("\n--- 7. Fixing IP_127.0.0.1 referrer ---")
    ip_doc = db["ip"].find_one({"_id": "IP_127.0.0.1"})
    if ip_doc and ip_doc.get("referrer") == "Archer":
        print(f"  Clearing referrer 'Archer' on IP_127.0.0.1")
        if not DRY_RUN:
            db["ip"].update_one({"_id": "IP_127.0.0.1"}, {"$set": {"referrer": ""}})
    elif ip_doc:
        print(f"  IP_127.0.0.1 referrer is: {ip_doc.get('referrer', '(not set)')}")
    else:
        print("  IP_127.0.0.1 not found")

    print("\n--- Done! ---")
    client.close()


if __name__ == "__main__":
    main()
