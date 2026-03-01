#!/usr/bin/env python3
"""Query production MongoDB for Characters and Users where .online is true."""

from pymongo import MongoClient
from mongo_config import MONGO_URI, MONGO_DB

db = MongoClient(MONGO_URI)[MONGO_DB]

print("=== Users with online=true ===\n")
online_users = list(db.user.find({"online": True}))
print(f"Count: {len(online_users)}")
for u in online_users:
    print(f"  {u['_id']}  name={u.get('name', '?')}  email={u.get('email', '?')}  online={u.get('online')}")

print("\n=== Characters with online=true ===\n")
online_chars = list(db.character.find({"online": True}))
print(f"Count: {len(online_chars)}")
for c in online_chars:
    print(f"  {c['_id']}  name={c.get('name', '?')}  owner={c.get('owner', '?')}  server={c.get('server', '?')}  map={c.get('map', '?')}  x={c.get('x', '?')}  y={c.get('y', '?')}")

db.client.close()
