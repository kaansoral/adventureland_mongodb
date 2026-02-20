#!/usr/bin/env python3
"""Fix info.data=true: remove info.data field where it's boolean True (leftover from Python/AppEngine blob pattern)"""
from pymongo import MongoClient
from mongo_config import MONGO_URI, MONGO_DB

client = MongoClient(MONGO_URI)
db = client[MONGO_DB]

collections = ["user", "character", "guild", "pet", "server", "message", "mail", "event", "map", "infoelement", "upload", "ip"]

total = 0
for coll_name in collections:
    result = db[coll_name].update_many({"info.data": True}, {"$unset": {"info.data": ""}})
    if result.modified_count:
        print(f"{coll_name}: {result.modified_count} fixed")
        total += result.modified_count
    else:
        print(f"{coll_name}: clean")

client.close()
print(f"\nDone! {total} documents fixed")
