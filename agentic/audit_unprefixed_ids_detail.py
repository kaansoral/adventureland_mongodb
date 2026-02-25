#!/usr/bin/env python3
"""
Detailed follow-up audit for the issues found by audit_unprefixed_ids.py.
Distinguishes null/empty from actual unprefixed values.
"""

import sys
import os
from urllib.parse import quote_plus
from pymongo import MongoClient

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if os.environ.get("MONGO_URI"):
    from mongo_config import MONGO_URI, MONGO_DB
    DB_NAME = MONGO_DB
else:
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


def main():
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]

    print("=" * 70)
    print("DETAILED ISSUE BREAKDOWN")
    print("=" * 70)

    # ===== 1. character.server =====
    print("\n--- character.server (6 affected) ---")
    docs = list(db.character.find(
        {"server": {"$exists": True, "$ne": None, "$ne": ""}},
        {"_id": 1, "server": 1}
    ))
    null_count = db.character.count_documents({"$or": [
        {"server": None}, {"server": ""}, {"server": {"$exists": False}}
    ]})
    print(f"  Null/empty/missing: {null_count}")
    print(f"  With actual value: {len(docs)}")
    for d in docs:
        prefix = "OK" if str(d["server"]).startswith("SR_") else "UNPREFIXED"
        print(f"    [{prefix}] {d['_id']} -> server={d['server']}")

    # ===== 2. character.guild =====
    print("\n--- character.guild (88 flagged, mostly None) ---")
    null_count = db.character.count_documents({"$or": [
        {"guild": None}, {"guild": ""}, {"guild": {"$exists": False}}
    ]})
    with_guild = list(db.character.find(
        {"guild": {"$exists": True, "$ne": None, "$ne": ""}},
        {"_id": 1, "guild": 1}
    ))
    print(f"  Null/empty/missing: {null_count}")
    print(f"  With actual guild value: {len(with_guild)}")
    for d in with_guild:
        prefix = "OK" if str(d["guild"]).startswith("GU_") else "UNPREFIXED"
        print(f"    [{prefix}] {d['_id']} -> guild={d['guild']}")

    # ===== 3. user.guild =====
    print("\n--- user.guild (41 flagged, mostly None) ---")
    null_count = db.user.count_documents({"$or": [
        {"guild": None}, {"guild": ""}, {"guild": {"$exists": False}}
    ]})
    with_guild = list(db.user.find(
        {"guild": {"$exists": True, "$ne": None, "$ne": ""}},
        {"_id": 1, "guild": 1}
    ))
    print(f"  Null/empty/missing: {null_count}")
    print(f"  With actual guild value: {len(with_guild)}")
    for d in with_guild:
        prefix = "OK" if str(d["guild"]).startswith("GU_") else "UNPREFIXED"
        print(f"    [{prefix}] {d['_id']} -> guild={d['guild']}")

    # ===== 4. user.referrer =====
    print("\n--- user.referrer (13 flagged) ---")
    null_count = db.user.count_documents({"$or": [
        {"referrer": None}, {"referrer": ""}, {"referrer": {"$exists": False}}
    ]})
    with_ref = list(db.user.find(
        {"referrer": {"$exists": True, "$ne": None, "$ne": ""}},
        {"_id": 1, "referrer": 1}
    ))
    print(f"  Null/empty/missing: {null_count}")
    print(f"  With actual referrer value: {len(with_ref)}")
    for d in with_ref:
        prefix = "OK" if str(d["referrer"]).startswith("US_") else "UNPREFIXED"
        print(f"    [{prefix}] {d['_id']} -> referrer={d['referrer']}")

    # ===== 5. user.info.characters[].server =====
    print("\n--- user.info.characters[].server (6 users affected) ---")
    docs = list(db.user.find(
        {"info.characters": {"$exists": True}},
        {"_id": 1, "info.characters": 1}
    ))
    for u in docs:
        chars = u.get("info", {}).get("characters", [])
        if not isinstance(chars, list):
            continue
        for c in chars:
            if not isinstance(c, dict):
                continue
            srv = c.get("server")
            cid = c.get("id")
            if srv and srv != "" and not str(srv).startswith("SR_"):
                print(f"  [UNPREFIXED] user={u['_id']}, char={cid}, server={srv}")
            elif srv and str(srv).startswith("SR_"):
                pass  # OK
            # None/empty is fine for characters without a server

    # ===== 6. message.owner - ~global, ~EUPVP etc are channel names, not user IDs =====
    print("\n--- message.owner (152 flagged) ---")
    distinct_owners = db.message.distinct("owner")
    print(f"  Distinct owner values: {distinct_owners}")
    for ov in sorted(set(str(x) for x in distinct_owners)):
        count = db.message.count_documents({"owner": ov})
        prefix = "OK" if ov.startswith("US_") else ("CHANNEL" if ov.startswith("~") else "UNPREFIXED")
        print(f"    [{prefix}] owner={ov}: {count} messages")

    # ===== 7. message.to / message.fro - character names =====
    print("\n--- message.to (146 flagged) ---")
    distinct_to = db.message.distinct("to")
    print(f"  Distinct 'to' values ({len(distinct_to)}): {distinct_to[:20]}")

    print("\n--- message.fro (298 flagged) ---")
    distinct_fro = db.message.distinct("fro")
    print(f"  Distinct 'fro' values ({len(distinct_fro)}): {distinct_fro[:20]}")

    # ===== 8. mail.to / mail.fro - character names =====
    print("\n--- mail.to (270 flagged) ---")
    distinct_to = db.mail.distinct("to")
    print(f"  Distinct 'to' values ({len(distinct_to)}): {distinct_to[:20]}")

    print("\n--- mail.fro (270 flagged) ---")
    distinct_fro = db.mail.distinct("fro")
    print(f"  Distinct 'fro' values ({len(distinct_fro)}): {distinct_fro[:20]}")

    # ===== 9. ip.referrer =====
    print("\n--- ip.referrer (1 flagged) ---")
    docs = list(db.ip.find(
        {"referrer": {"$exists": True, "$ne": None, "$ne": ""}},
        {"_id": 1, "referrer": 1}
    ))
    for d in docs:
        print(f"  {d['_id']} -> referrer={d['referrer']}")

    # ===== 10. Stale infoelement with pipe in _id =====
    print("\n--- infoelement: stale/unusual _ids ---")
    unusual = list(db.infoelement.find(
        {"_id": {"$regex": "\\|"}},
        {"_id": 1}
    ))
    if unusual:
        print(f"  Found {len(unusual)} docs with '|' in _id:")
        for d in unusual:
            print(f"    {d['_id']}")
    else:
        print("  No unusual _ids with '|' found")

    # Check rrewardmark entries
    rreward = list(db.infoelement.find(
        {"_id": {"$regex": "^IE_rrewardmark"}},
        {"_id": 1}
    ))
    if rreward:
        print(f"\n  rrewardmark entries ({len(rreward)}):")
        for d in rreward:
            print(f"    {d['_id']}")

    # Check 'users' collection (plural) - is this a duplicate?
    print("\n--- 'users' collection (plural, separate from 'user') ---")
    users_count = db.users.count_documents({})
    print(f"  Count: {users_count}")
    if users_count > 0:
        samples = list(db.users.find({}, {"_id": 1, "email": 1}).limit(5))
        for s in samples:
            print(f"    _id={s['_id']}, email={s.get('email')}")

    # Check 'messages' collection (plural, separate from 'message')
    print("\n--- 'messages' collection (plural, separate from 'message') ---")
    messages_count = db.messages.count_documents({})
    print(f"  Count: {messages_count}")
    if messages_count > 0:
        samples = list(db.messages.find({}).limit(3))
        for s in samples:
            print(f"    _id={s['_id']}, keys={list(s.keys())}")

    # ===== 11. Server IDs in server collection — are they the short names? =====
    print("\n--- server collection: full _id list + info.name check ---")
    servers = list(db.server.find({}, {"_id": 1, "info": 1}))
    for s in servers:
        info = s.get("info", {})
        name = info.get("name", "N/A") if isinstance(info, dict) else "N/A"
        region = info.get("region", "N/A") if isinstance(info, dict) else "N/A"
        print(f"  _id={s['_id']}, info.name={name}, info.region={region}")

    # ===== 12. Check if character.server values match any server._id pattern =====
    print("\n--- Character server values vs Server _ids ---")
    char_servers = db.character.distinct("server")
    server_ids = [s["_id"] for s in db.server.find({}, {"_id": 1})]
    server_short_names = [sid.replace("SR_", "") for sid in server_ids]
    for cs in char_servers:
        if not cs:
            continue
        if f"SR_{cs}" in server_ids:
            print(f"  character.server='{cs}' -> should be 'SR_{cs}' (exists in server collection)")
        elif cs in server_ids:
            print(f"  character.server='{cs}' -> already prefixed (OK)")
        else:
            print(f"  character.server='{cs}' -> NO MATCHING SERVER FOUND (SR_{cs} not in collection)")

    print("\n" + "=" * 70)
    print("Detail audit complete.")
    print("=" * 70)

    client.close()


if __name__ == "__main__":
    main()
