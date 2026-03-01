#!/usr/bin/env python3
"""Search MongoDB for bare numeric ID 5196139963351040"""

import subprocess, json, os, sys

# Load production keys via node
keys_path = os.path.join(os.path.dirname(__file__), "..", "secretsandconfig", "keys_production.js")
result = subprocess.run(
    ["node", "-e", f"var k = require('{os.path.abspath(keys_path)}'); console.log(JSON.stringify(k))"],
    capture_output=True, text=True
)
keys = json.loads(result.stdout)

from pymongo import MongoClient

client = MongoClient(keys["mongodb_uri"], tlsCAFile=os.path.join(os.path.dirname(__file__), "..", "secretsandconfig", "prod-cluster-ca.crt"))
db = client[keys["mongodb_name"]]

target = "5196139963351040"

print(f"=== Searching for bare ID: {target} ===\n")

for coll_name in sorted(db.list_collection_names()):
    coll = db[coll_name]

    # Search by _id (bare)
    doc = coll.find_one({"_id": target})
    if doc:
        print(f"[{coll_name}] _id={target}")
        print(f"  keys: {list(doc.keys())[:15]}")
        if "name" in doc: print(f"  name: {doc['name']}")
        if "email" in doc: print(f"  email: {doc['email']}")
        if "owner" in doc: print(f"  owner: {doc['owner']}")
        print()

    # Search by _id with US_ prefix
    doc = coll.find_one({"_id": "US_" + target})
    if doc:
        print(f"[{coll_name}] _id=US_{target}")
        print(f"  name: {doc.get('name','?')}  email: {doc.get('email','?')}")
        print()

    # Search by _id with CH_ prefix
    doc = coll.find_one({"_id": "CH_" + target})
    if doc:
        print(f"[{coll_name}] _id=CH_{target}")
        print(f"  name: {doc.get('name','?')}  owner: {doc.get('owner','?')}")
        print()

    # Search owner field (bare)
    doc = coll.find_one({"owner": target})
    if doc:
        print(f"[{coll_name}] has owner={target}: _id={doc['_id']} name={doc.get('name','?')}")
        print()

    # Search referrer field (bare)
    if coll_name == "user":
        doc = coll.find_one({"referrer": target})
        if doc:
            print(f"[user] has referrer={target}: _id={doc['_id']} name={doc.get('name','?')}")
            print()
        doc = coll.find_one({"friends": target})
        if doc:
            print(f"[user] has friends containing {target}: _id={doc['_id']} name={doc.get('name','?')}")
            print()

# Search characters with bare numeric owner
print("=== Characters with bare numeric owner ===")
for doc in db["character"].find({"owner": {"$regex": "^[0-9]+$"}}):
    print(f"  _id={doc['_id']}  name={doc.get('name','?')}  owner={doc['owner']}")

print("\nDone.")
client.close()
