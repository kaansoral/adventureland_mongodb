#!/usr/bin/env python3
"""Read test@test.com from MongoDB to inspect password and salt storage."""

import os
import json
from pymongo import MongoClient

from mongo_config import MONGO_URI, MONGO_DB

db = MongoClient(MONGO_URI)[MONGO_DB]

# Find by email
print("=== Looking up by email test@test.com ===\n")

# email could be string or array
for query in [{"email": "test@test.com"}, {"info.email": "test@test.com"}]:
    print(f"Query: {query}")
    user = db.user.find_one(query)
    if user:
        print(f"  Found: {user['_id']}")
        print(f"  password type: {type(user.get('password')).__name__}")
        print(f"  password value: {repr(user.get('password'))}")
        print(f"  password len: {len(str(user.get('password', '')))}")
        print()
        print(f"  info type: {type(user.get('info')).__name__}")
        info = user.get("info", {})
        if isinstance(info, dict):
            print(f"  info.salt type: {type(info.get('salt')).__name__}")
            print(f"  info.salt value: {repr(info.get('salt'))}")
            print(f"  info.email: {repr(info.get('email'))}")
            print(f"  info.auths: {repr(info.get('auths'))}")
            print(f"  info.characters: {repr(info.get('characters'))}")
            print(f"  info keys: {sorted(info.keys())}")
        else:
            print(f"  info value: {repr(info)}")
        print()
        print(f"  email (top-level): {repr(user.get('email'))}")
        print(f"  name: {repr(user.get('name'))}")
        print(f"  platform: {repr(user.get('platform'))}")
        print(f"  pid: {repr(user.get('pid'))}")
        print()
    else:
        print("  Not found\n")

# Also try by ID directly
for uid in ["US_5216035270033408", "5216035270033408"]:
    user = db.user.find_one({"_id": uid})
    if user:
        print(f"=== Found by _id={uid} ===")
        print(f"  password: {repr(user.get('password'))}")
        info = user.get("info", {})
        if isinstance(info, dict):
            print(f"  info.salt: {repr(info.get('salt'))}")
        break

db.client.close()
