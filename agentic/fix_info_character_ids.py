#!/usr/bin/env python3
"""
Fix info.characters[].id — prefix unprefixed numeric IDs with CH_.
"""

import os
from pymongo import MongoClient

from mongo_config import MONGO_URI, MONGO_DB

DRY_RUN = os.environ.get("DRY_RUN", "0") == "1"


def main():
    if DRY_RUN:
        print("=== DRY RUN MODE ===\n")

    print(f"Connecting to MongoDB: {MONGO_DB}...")
    db = MongoClient(MONGO_URI)[MONGO_DB]

    fixed = 0
    for user in db.user.find({"info.characters": {"$exists": True, "$ne": []}}):
        characters = user["info"].get("characters", [])
        changed = False
        for ch in characters:
            if isinstance(ch, dict) and "id" in ch:
                cid = str(ch["id"])
                if cid and not cid.startswith("CH_"):
                    ch["id"] = "CH_" + cid
                    changed = True

        if changed:
            print(f"  {user['_id']}: {[ch.get('id') for ch in characters]}")
            if not DRY_RUN:
                db.user.update_one(
                    {"_id": user["_id"]},
                    {"$set": {"info.characters": characters}},
                )
            fixed += 1

    print(f"\nFixed {fixed} user docs")
    print("Done!")


if __name__ == "__main__":
    main()
