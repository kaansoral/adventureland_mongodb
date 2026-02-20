#!/usr/bin/env python3
"""Read kaansoral@gmail.com from MongoDB to inspect code_list."""

import os
import json
from pymongo import MongoClient

from mongo_config import MONGO_URI, MONGO_DB

db = MongoClient(MONGO_URI)[MONGO_DB]

# Find by email
for query in [{"email": "kaansoral@gmail.com"}, {"info.email": "kaansoral@gmail.com"}]:
    user = db.user.find_one(query)
    if user:
        print(f"=== MongoDB User: {user['_id']} ({user.get('name')}) ===\n")
        info = user.get("info", {})

        # Check code_list in info
        code_list = info.get("code_list")
        if code_list is not None:
            print(f"info.code_list type: {type(code_list).__name__}")
            print(f"info.code_list value: {json.dumps(code_list, indent=2, default=str)}")
        else:
            print("info.code_list: NOT FOUND")

        # Also check top-level
        top_code_list = user.get("code_list")
        if top_code_list is not None:
            print(f"\ntop-level code_list type: {type(top_code_list).__name__}")
            print(f"top-level code_list value: {json.dumps(top_code_list, indent=2, default=str)}")

        # Show all info keys for context
        if isinstance(info, dict):
            print(f"\nAll info keys: {sorted(info.keys())}")
        break
else:
    print("User not found in MongoDB")

db.client.close()
