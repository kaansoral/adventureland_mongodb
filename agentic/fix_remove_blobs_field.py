#!/usr/bin/env python3
"""
Remove the 'blobs' field that was added by the SQLite migration as reference metadata.
It doesn't belong on actual entities.
"""

import os
from pymongo import MongoClient

from mongo_config import MONGO_URI, MONGO_DB

COLLECTIONS = ["user", "character", "guild", "pet", "mail", "message", "event", "infoelement", "server", "ip", "mark", "backup", "upload"]


def main():
    print(f"Connecting to MongoDB: {MONGO_DB}...")
    db = MongoClient(MONGO_URI)[MONGO_DB]

    for coll_name in COLLECTIONS:
        coll = db[coll_name]
        r = coll.update_many({"blobs": {"$exists": True}}, {"$unset": {"blobs": ""}})
        if r.modified_count:
            print(f"  {coll_name}: removed blobs from {r.modified_count} docs")

    print("\nDone!")


if __name__ == "__main__":
    main()
