#!/usr/bin/env python3
"""
Fix NaN code slots in MongoDB.

When parseInt("CH_xxx") was used on character IDs, it produced NaN,
which got stored as the string "NaN" in code_list keys and USERCODE entity IDs.

This script:
1. Finds all user_data docs with code_list["NaN"] entries and removes them
2. Finds all IE_USERCODE-*-NaN documents and deletes them

Usage:
  python fix_nan_code_slots.py
  DRY_RUN=1 python fix_nan_code_slots.py
"""

import os
from pymongo import MongoClient

from mongo_config import MONGO_URI, MONGO_DB

DRY_RUN = os.environ.get("DRY_RUN", "0") == "1"


def main():
    client = MongoClient(MONGO_URI)
    db = client[MONGO_DB]
    ie_col = db["InfoElement"]

    if DRY_RUN:
        print("=== DRY RUN MODE ===\n")

    # 1. Remove NaN keys from code_list in user_data docs
    print("--- Fixing code_list NaN entries in user_data ---")
    nan_userdata = list(ie_col.find({"info.code_list.NaN": {"$exists": True}}))
    print(f"Found {len(nan_userdata)} user_data docs with code_list.NaN")

    for doc in nan_userdata:
        doc_id = doc["_id"]
        nan_value = doc.get("info", {}).get("code_list", {}).get("NaN")
        print(f"  {doc_id}: code_list.NaN = {nan_value}")
        if not DRY_RUN:
            ie_col.update_one(
                {"_id": doc_id},
                {"$unset": {"info.code_list.NaN": ""}}
            )
            print(f"    -> Removed NaN key")

    # 2. Delete IE_USERCODE-*-NaN documents
    print("\n--- Deleting IE_USERCODE-*-NaN documents ---")
    nan_usercodes = list(ie_col.find({"_id": {"$regex": r"^IE_USERCODE-.*-NaN$"}}))
    print(f"Found {len(nan_usercodes)} IE_USERCODE-*-NaN documents")

    for doc in nan_usercodes:
        doc_id = doc["_id"]
        code_preview = str(doc.get("info", {}).get("code", ""))[:80]
        print(f"  {doc_id}: code preview = {code_preview!r}")
        if not DRY_RUN:
            ie_col.delete_one({"_id": doc_id})
            print(f"    -> Deleted")

    print("\nDone!")
    if DRY_RUN:
        print("(No changes made — run without DRY_RUN=1 to apply)")

    client.close()


if __name__ == "__main__":
    main()
