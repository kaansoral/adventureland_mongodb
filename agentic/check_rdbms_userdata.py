#!/usr/bin/env python3
"""
Quick check: do the existing RDBMS-migrated IE_userdata-{numeric_id} docs
in MongoDB have correct code_list data, or is it corrupted?
"""

import os
import json
from pymongo import MongoClient

from mongo_config import MONGO_URI, MONGO_DB

db = MongoClient(MONGO_URI)[MONGO_DB]

print("=== RDBMS-migrated userdata (numeric ID keys) ===\n")
# These are the ones with bare numeric IDs (from RDBMS migration)
rdbms_count = 0
has_code_list = 0
corrupted = 0
sample_shown = 0

for ie in db.infoelement.find({"_id": {"$regex": "^IE_userdata-\\d"}}):
    rdbms_count += 1
    info = ie.get("info", {})
    cl = info.get("code_list")
    if cl and isinstance(cl, dict) and len(cl) > 0:
        has_code_list += 1
        # Check for NaN keys
        if "NaN" in cl or any("NaN" in str(k) for k in cl.keys()):
            corrupted += 1
            if sample_shown < 3:
                print(f"  CORRUPTED: {ie['_id']} code_list={cl}")
                sample_shown += 1
        elif sample_shown < 3:
            slots = list(cl.items())[:5]
            print(f"  OK: {ie['_id']} ({len(cl)} slots) sample={slots}")
            sample_shown += 1

print(f"\nTotal RDBMS userdata: {rdbms_count}")
print(f"  With code_list: {has_code_list}")
print(f"  Corrupted (NaN): {corrupted}")

print("\n=== Runtime-created userdata (US_ prefix keys) ===\n")
us_count = 0
us_has_cl = 0
us_corrupted = 0
sample_shown = 0

for ie in db.infoelement.find({"_id": {"$regex": "^IE_userdata-US_"}}):
    us_count += 1
    info = ie.get("info", {})
    cl = info.get("code_list")
    if cl and isinstance(cl, dict) and len(cl) > 0:
        us_has_cl += 1
        if "NaN" in cl:
            us_corrupted += 1
        if sample_shown < 3:
            slots = list(cl.items())[:5]
            print(f"  {ie['_id']} ({len(cl)} slots) sample={slots}")
            sample_shown += 1

print(f"\nTotal US_ userdata: {us_count}")
print(f"  With code_list: {us_has_cl}")
print(f"  Corrupted (NaN): {us_corrupted}")

db.client.close()
