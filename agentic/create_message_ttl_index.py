#!/usr/bin/env python3
"""Create TTL index on message collection to expire non-private messages after 90 days.

Private messages are excluded via partialFilterExpression.

Usage:
  TARGET=dev  .venv/bin/python create_message_ttl_index.py
  TARGET=prod .venv/bin/python create_message_ttl_index.py
"""

from pymongo import MongoClient
from mongo_config import MONGO_URI, MONGO_DB, TARGET

db = MongoClient(MONGO_URI)[MONGO_DB]

print(f"Target: {TARGET} ({MONGO_DB})")
print("Creating TTL index on message.created (90 days, non-private only)...")

result = db.message.create_index(
    [("created", 1)],
    expireAfterSeconds=7776000,  # 90 days
    partialFilterExpression={"type": {"$in": ["ambient", "server"]}},
    name="ttl_non_private_messages_90d",
)

print(f"Index created: {result}")

# Verify
indexes = db.message.index_information()
ttl = indexes.get("ttl_non_private_messages_90d")
if ttl:
    print(f"Verified: expireAfterSeconds={ttl.get('expireAfterSeconds')}, partialFilterExpression={ttl.get('partialFilterExpression')}")
else:
    print("WARNING: Index not found after creation!")

db.client.close()
