#!/usr/bin/env python3
"""
Fix repeated properties that were imported incorrectly from SQLite protobuf migration.

The protobuf parser used `props[pname] = val` which overwrites on repeated fields,
so only the last value survived as a flat string instead of an array.

Affected fields:
  - friends (User, Character): string → ['US_' + string]
  - email (User): string is fine (single value), but ensure consistency

Also prefixes any unprefixed numeric IDs in friends arrays with 'US_'.
"""

import os
from pymongo import MongoClient

from mongo_config import MONGO_URI, MONGO_DB

DRY_RUN = os.environ.get("DRY_RUN", "0") == "1"


def fix_friends(db, collection_name):
    """Fix friends field: string → US_-prefixed array, and prefix existing array entries."""
    coll = db[collection_name]
    fixed = 0

    # 1) String friends → array with US_ prefix
    for doc in coll.find({"friends": {"$type": "string"}}):
        old = doc["friends"]
        if not old:
            new_friends = []
        else:
            new_friends = ["US_" + old] if not old.startswith("US_") else [old]

        print(f"  {doc['_id']}: string '{old}' → {new_friends}")
        if not DRY_RUN:
            coll.update_one({"_id": doc["_id"]}, {"$set": {"friends": new_friends}})
        fixed += 1

    # 2) Array friends — prefix any unprefixed numeric IDs
    for doc in coll.find({"friends": {"$type": "array", "$ne": []}}):
        old = doc["friends"]
        new_friends = []
        changed = False
        for fid in old:
            if isinstance(fid, str) and fid.isdigit():
                new_friends.append("US_" + fid)
                changed = True
            elif isinstance(fid, int):
                new_friends.append("US_" + str(fid))
                changed = True
            else:
                new_friends.append(fid)

        if changed:
            print(f"  {doc['_id']}: prefix {old} → {new_friends}")
            if not DRY_RUN:
                coll.update_one({"_id": doc["_id"]}, {"$set": {"friends": new_friends}})
            fixed += 1

    return fixed


def ensure_friends_array(db, collection_name):
    """Ensure friends field exists and is an array for all docs."""
    coll = db[collection_name]
    # Missing friends field → empty array
    result = coll.update_many(
        {"friends": {"$exists": False}},
        {"$set": {"friends": []}},
    )
    if result.modified_count:
        print(f"  Added empty friends[] to {result.modified_count} {collection_name} docs")
    return result.modified_count


def main():
    if DRY_RUN:
        print("=== DRY RUN MODE (set DRY_RUN=0 or unset to apply) ===\n")

    print(f"Connecting to MongoDB: {MONGO_DB}...")
    db = MongoClient(MONGO_URI)[MONGO_DB]

    print("\n--- Fixing User friends ---")
    fixed = fix_friends(db, "user")
    print(f"  Fixed {fixed} user docs")

    print("\n--- Fixing Character friends ---")
    fixed = fix_friends(db, "character")
    print(f"  Fixed {fixed} character docs")

    print("\n--- Ensuring friends arrays exist ---")
    ensure_friends_array(db, "user")
    ensure_friends_array(db, "character")

    print("\nDone!")


if __name__ == "__main__":
    main()
