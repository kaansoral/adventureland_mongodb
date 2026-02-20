#!/usr/bin/env python3
"""
Read user_data (InfoElement) for kaansoral@gmail.com from both Datastore and MongoDB.
Compares code_list specifically.
"""

import os
import sys
import pickle
import io
import json

from google.cloud import datastore
from pymongo import MongoClient

os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "..", "secretsandconfig", "twodimensionalgame_datastore_reader.json",
)

from mongo_config import MONGO_URI, MONGO_DB


class GG:
    pass

class MockUnpickler(pickle.Unpickler):
    def find_class(self, module, name):
        if name == "GG":
            return GG
        if module in ("cgi", "config"):
            return GG
        try:
            return super().find_class(module, name)
        except Exception:
            return GG

def gg_to_dict(obj):
    if isinstance(obj, GG):
        return gg_to_dict(obj.__dict__)
    if isinstance(obj, dict):
        return {str(k): gg_to_dict(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [gg_to_dict(v) for v in obj]
    if isinstance(obj, bytes):
        try:
            return obj.decode("utf-8")
        except Exception:
            return f"<{len(obj)} bytes>"
    return obj

def safe_unpickle(blob):
    for enc in [None, "latin-1", "bytes"]:
        try:
            kwargs = {"encoding": enc} if enc else {}
            return gg_to_dict(MockUnpickler(io.BytesIO(blob), **kwargs).load())
        except Exception:
            pass
    return f"<unpicklable {len(blob)} bytes>"


def main():
    ds = datastore.Client(project="twodimensionalgame")
    db = MongoClient(MONGO_URI)[MONGO_DB]

    # 1. Find user in Datastore
    print("=== Datastore: Looking up kaansoral@gmail.com ===\n")
    query = ds.query(kind="User")
    query.add_filter(filter=datastore.query.PropertyFilter("email", "=", "kaansoral@gmail.com"))
    users = list(query.fetch(limit=1))
    if not users:
        print("User not found in Datastore!")
        return

    user = users[0]
    ds_user_id = str(user.key.id)
    print(f"Datastore User ID: {ds_user_id}")

    # 2. Get userdata InfoElement from Datastore
    userdata_key = f"userdata-{ds_user_id}"
    print(f"\n=== Datastore: InfoElement key={userdata_key} ===\n")
    key = ds.key("InfoElement", userdata_key)
    userdata = ds.get(key)

    if userdata:
        info = userdata.get("info")
        if isinstance(info, bytes):
            info = safe_unpickle(info)

        if isinstance(info, dict):
            code_list = info.get("code_list")
            if code_list:
                print(f"Datastore code_list ({type(code_list).__name__}):")
                if isinstance(code_list, dict):
                    for slot, val in sorted(code_list.items(), key=lambda x: str(x[0])):
                        print(f"  slot {slot}: {val}")
                else:
                    print(f"  {repr(code_list)}")
            else:
                print("Datastore code_list: NOT FOUND in info")
                print(f"Datastore info keys: {sorted(info.keys())}")
        else:
            print(f"Datastore info type: {type(info)}")
    else:
        print("InfoElement NOT FOUND in Datastore!")

    # 3. Check MongoDB - try multiple possible IDs
    print(f"\n=== MongoDB: Checking InfoElement ===\n")

    # The RDBMS-migrated user
    mongo_user = db.user.find_one({"email": "kaansoral@gmail.com"})
    if mongo_user:
        mongo_user_id = mongo_user["_id"]
        print(f"MongoDB User _id: {mongo_user_id}")
    else:
        mongo_user_id = None
        print("User not found in MongoDB by email!")

    # Try various IE_ keys
    possible_keys = [
        f"IE_userdata-{ds_user_id}",
    ]
    if mongo_user_id:
        possible_keys.append(f"IE_userdata-{mongo_user_id}")

    for ie_key in possible_keys:
        print(f"\nLooking up: {ie_key}")
        ie = db.infoelement.find_one({"_id": ie_key})
        if ie:
            print(f"  FOUND!")
            info = ie.get("info", {})
            if isinstance(info, dict):
                code_list = info.get("code_list")
                if code_list:
                    print(f"  MongoDB code_list ({type(code_list).__name__}):")
                    if isinstance(code_list, dict):
                        for slot, val in sorted(code_list.items(), key=lambda x: str(x[0])):
                            print(f"    slot {slot}: {val}")
                    else:
                        print(f"    {repr(code_list)}")
                else:
                    print(f"  MongoDB code_list: NOT FOUND in info")
                    print(f"  MongoDB info keys: {sorted(info.keys())}")
            else:
                print(f"  info type: {type(info)}")
        else:
            print(f"  NOT FOUND")

    # 4. Also search for any IE_ with "userdata" in key
    print(f"\n=== MongoDB: All userdata InfoElements ===\n")
    for ie in db.infoelement.find({"_id": {"$regex": "^IE_userdata"}}).limit(20):
        info = ie.get("info", {})
        has_cl = "code_list" in info if isinstance(info, dict) else False
        print(f"  {ie['_id']}  has_code_list={has_cl}")

    db.client.close()
    print("\nDone!")


if __name__ == "__main__":
    main()
