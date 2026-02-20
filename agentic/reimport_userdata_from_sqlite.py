#!/usr/bin/env python3
"""
Re-import InfoElement userdata from local SQLite (db.rdbms) into MongoDB.

Fixes from original _migrate_rdbms.py:
  - Keys now use US_ prefix: IE_userdata-US_{numeric_id} (matching runtime expectations)
  - The runtime does: get("IE_userdata-" + user._id) where user._id = "US_xxx"

Also cleans up:
  - Old RDBMS keys without US_ prefix (IE_userdata-{numeric_id})
  - Runtime-auto-created corrupted docs (IE_userdata-US_{id} with NaN code_list)

Usage:
  python reimport_userdata_from_sqlite.py
  DRY_RUN=1 python reimport_userdata_from_sqlite.py
"""

import sqlite3
import pickle
import struct
import io
import datetime
import os
import sys

from pymongo import MongoClient

RDBMS_PATH = "/Users/kaan/Desktop/PROJECTS/thegame/storage/db.rdbms"
from mongo_config import MONGO_URI, MONGO_DB

DRY_RUN = os.environ.get("DRY_RUN", "0") == "1"


# ==================== Protobuf Parser (from _migrate_rdbms.py) ====================

class GG:
    def __init__(self):
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


def read_varint(buf, pos):
    result = 0; shift = 0
    while pos < len(buf):
        b = buf[pos]; pos += 1
        result |= (b & 0x7f) << shift
        if not (b & 0x80): break
        shift += 7
    return result, pos


def parse_pb(buf, pos=0, end=None):
    if end is None: end = len(buf)
    fields = []
    while pos < end:
        tag, pos = read_varint(buf, pos)
        fn = tag >> 3; wt = tag & 7
        if wt == 0:
            val, pos = read_varint(buf, pos)
        elif wt == 1:
            val = buf[pos:pos+8]; pos += 8
        elif wt == 2:
            l, pos = read_varint(buf, pos)
            val = buf[pos:pos+l]; pos += l
        elif wt in (3, 4):
            val = None
        elif wt == 5:
            val = buf[pos:pos+4]; pos += 4
        else:
            break
        fields.append((fn, wt, val))
    return fields


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
        except:
            return None
    if isinstance(obj, int) and (obj > 2**63 - 1 or obj < -(2**63)):
        return str(obj)
    if isinstance(obj, datetime.datetime):
        return obj
    return obj


def unpickle_blob(blob):
    for enc in [None, "latin-1", "bytes"]:
        try:
            kwargs = {"encoding": enc} if enc else {}
            return gg_to_dict(MockUnpickler(io.BytesIO(blob), **kwargs).load())
        except Exception:
            pass
    return None


def parse_entity(data):
    """Parse a protobuf entity from the SQLite RDBMS."""
    fields = parse_pb(data)
    kind = None; num_id = None; str_name = None; props = {}

    for fn, wt, val in fields:
        if fn == 13 and wt == 2:
            for kfn, kwt, kval in parse_pb(val):
                if kfn == 14 and kwt == 2:
                    for pfn, pwt, pval in parse_pb(kval):
                        if pfn == 2 and pwt == 2: kind = pval.decode("utf-8")
                        if pfn == 3 and pwt == 0: num_id = pval
                        if pfn == 4 and pwt == 2: str_name = pval.decode("utf-8")

    entity_id = str_name or str(num_id)

    for fn, wt, val in fields:
        if fn not in (14, 15): continue
        pfields = parse_pb(val)
        pname = None; meaning = None; raw_val = None
        for pfn, pwt, pval in pfields:
            if pfn == 1 and pwt == 0: meaning = pval
            if pfn == 3 and pwt == 2: pname = pval.decode("utf-8", errors="replace")
            if pfn == 5 and pwt == 2:
                for vfn, vwt, vval in parse_pb(pval):
                    if vfn == 1 and vwt == 0: raw_val = ("int", vval)
                    if vfn == 2 and vwt == 0: raw_val = ("bool", bool(vval))
                    if vfn == 3 and vwt == 2: raw_val = ("bytes", vval)
                    if vfn == 4 and vwt == 1: raw_val = ("double", struct.unpack("<d", vval)[0])
        if not pname: continue

        if meaning == 7 and raw_val and raw_val[0] == "int":
            props[pname] = datetime.datetime(1970, 1, 1) + datetime.timedelta(microseconds=raw_val[1])
        elif meaning == 14 and raw_val and raw_val[0] == "bytes":
            props[pname] = unpickle_blob(raw_val[1])
        elif raw_val and raw_val[0] == "bytes":
            try:
                props[pname] = raw_val[1].decode("utf-8")
            except:
                props[pname] = None
        elif raw_val:
            props[pname] = raw_val[1]
        else:
            props[pname] = None

    return kind, num_id, str_name, props


# ==================== Main ====================

def main():
    if DRY_RUN:
        print("=== DRY RUN MODE ===\n")

    print(f"Opening {RDBMS_PATH}...")
    conn = sqlite3.connect(RDBMS_PATH)
    cursor = conn.cursor()

    rows = cursor.execute(
        'SELECT kind, entity FROM "dev~twodimensionalgame!!Entities" WHERE kind="InfoElement" ORDER BY kind'
    ).fetchall()
    print(f"Found {len(rows)} InfoElement entities in SQLite\n")

    print(f"Connecting to MongoDB: {MONGO_DB}...")
    db = MongoClient(MONGO_URI)[MONGO_DB]

    imported = 0
    skipped = 0
    errors = 0
    old_keys_to_delete = []

    for blob_row in rows:
        kind_name, entity_blob = blob_row
        try:
            kind, num_id, str_name, props = parse_entity(entity_blob)
        except Exception as e:
            errors += 1
            print(f"  ERROR parsing entity: {e}")
            continue

        # Only process userdata- entities
        if not str_name or not str_name.startswith("userdata-"):
            skipped += 1
            continue

        # Extract the numeric user ID from the key name
        user_numeric_id = str_name.replace("userdata-", "")

        # Build the correct MongoDB key with US_ prefix
        correct_key = f"IE_userdata-US_{user_numeric_id}"
        old_key = f"IE_{str_name}"  # IE_userdata-{numeric_id} (wrong, no US_)

        # Build the document
        doc = {"_id": correct_key}

        skip_props = {"has_scatter", "__scatter__"}
        for key, val in props.items():
            if key in skip_props:
                continue
            doc[key] = val

        # Ensure info is a dict
        if "info" not in doc or not isinstance(doc.get("info"), dict):
            doc["info"] = {}

        info = doc.get("info", {})
        code_list = info.get("code_list", {})
        code_count = len(code_list) if isinstance(code_list, dict) else 0

        if not DRY_RUN:
            db.infoelement.replace_one({"_id": correct_key}, doc, upsert=True)
            old_keys_to_delete.append(old_key)
        else:
            cl_preview = ""
            if code_count:
                sample = list(code_list.items())[:3]
                cl_preview = f" sample={sample}"
            print(f"  {old_key} → {correct_key} ({code_count} code slots){cl_preview}")

        imported += 1

    # Clean up old keys (without US_ prefix)
    if not DRY_RUN and old_keys_to_delete:
        print(f"\nCleaning up {len(old_keys_to_delete)} old RDBMS keys (without US_ prefix)...")
        for old_key in old_keys_to_delete:
            result = db.infoelement.delete_one({"_id": old_key})
            if result.deleted_count:
                print(f"  Deleted {old_key}")

    print(f"\nImported {imported} userdata InfoElements (skipped {skipped} non-userdata, {errors} errors)")

    conn.close()
    db.client.close()
    print("Done!")


if __name__ == "__main__":
    main()
