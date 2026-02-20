#!/usr/bin/env python3
"""Fix guild references: add GU_ prefix to numeric guild IDs in user and character collections"""
from pymongo import MongoClient
from mongo_config import MONGO_URI, MONGO_DB

client = MongoClient(MONGO_URI)
db = client[MONGO_DB]

for coll_name in ["user", "character"]:
    coll = db[coll_name]
    docs = list(coll.find({"guild": {"$regex": r"^\d+$"}}))
    count = 0
    for doc in docs:
        new_guild = "GU_" + doc["guild"]
        coll.update_one({"_id": doc["_id"]}, {"$set": {"guild": new_guild}})
        count += 1
    print(f"{coll_name}: {count} guild refs fixed")

client.close()
print("Done!")
