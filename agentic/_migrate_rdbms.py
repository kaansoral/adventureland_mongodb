#!/usr/bin/env python3
"""
Temporary migration script: Parse App Engine local datastore (db.rdbms) → MongoDB
Reads from SQLite, converts protobuf+pickle entities, upserts into MongoDB.
"""
import sqlite3, pickle, struct, io, datetime, sys, os

from pymongo import MongoClient, ReplaceOne

RDBMS_PATH = "/Users/kaan/Desktop/PROJECTS/thegame/storage/db.rdbms"
from mongo_config import MONGO_URI, MONGO_DB

# Kind → (prefix, collection_name)
KIND_MAP = {
    "User":         ("US_", "user"),
    "Character":    ("CH_", "character"),
    "Guild":        ("GU_", "guild"),
    "Pet":          ("PT_", "pet"),
    "Server":       ("SR_", "server"),
    "Message":      ("MS_", "message"),
    "Mail":         ("ML_", "mail"),
    "Event":        ("EV_", "event"),
    "Backup":       ("BC_", "backup"),
    "Map":          ("MP_", "map"),
    "InfoElement":  ("IE_", "infoelement"),
    "Upload":       ("UL_", "upload"),
    "IP":           ("IP_", "ip"),
    "MarkedPhrase": ("MK_", "mark"),
    "Marker":       ("MK_", "mark"),
}

# Fields that contain references to User entities (numeric ID → US_ prefix)
USER_REF_FIELDS = {"owner", "referrer"}
# Fields that contain references to Guild entities (numeric ID → GU_ prefix)
GUILD_REF_FIELDS = {"guild"}

# ==================== Protobuf Parser ====================

class GG:
    """Mock for App Engine's config.GG pickle class"""
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
    """Recursively convert GG objects to plain dicts"""
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

def unpickle_blob(blob, kind, entity_id, pname):
    """Try multiple strategies to unpickle a blob"""
    # Strategy 1: default encoding
    try:
        return gg_to_dict(MockUnpickler(io.BytesIO(blob)).load())
    except Exception:
        pass
    # Strategy 2: latin-1 encoding (Python 2 pickles with non-ASCII bytes)
    try:
        return gg_to_dict(MockUnpickler(io.BytesIO(blob), encoding="latin-1").load())
    except Exception:
        pass
    # Strategy 3: bytes encoding (keep bytes as-is)
    try:
        return gg_to_dict(MockUnpickler(io.BytesIO(blob), encoding="bytes").load())
    except Exception as e:
        print(f"  WARNING: Failed to unpickle {pname} for {kind}/{entity_id}: {e}", flush=True)
        return None

def parse_entity(data):
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
            props[pname] = unpickle_blob(raw_val[1], kind, entity_id, pname)
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

def make_id(kind, num_id, str_name):
    if kind not in KIND_MAP:
        return None
    prefix = KIND_MAP[kind][0]
    if str_name:
        return prefix + str_name
    elif num_id:
        return prefix + str(num_id)
    return None

def to_mongo_doc(kind, num_id, str_name, props):
    doc = {}
    doc["_id"] = make_id(kind, num_id, str_name)
    if not doc["_id"]:
        return None

    skip_props = {"has_scatter", "__scatter__"}

    for key, val in props.items():
        if key in skip_props:
            continue
        if key in USER_REF_FIELDS and val and isinstance(val, str) and val.isdigit():
            doc[key] = "US_" + val
        elif key in USER_REF_FIELDS and val and isinstance(val, int):
            doc[key] = "US_" + str(val)
        elif key in GUILD_REF_FIELDS and val and isinstance(val, str) and val.isdigit():
            doc[key] = "GU_" + val
        elif key in GUILD_REF_FIELDS and val and isinstance(val, int):
            doc[key] = "GU_" + str(val)
        elif isinstance(val, int) and (val > 2**63 - 1 or val < -(2**63)):
            doc[key] = str(val)
        else:
            doc[key] = val

    # Ensure 'info' is a dict with blobs marker
    # For Map entities, info.data contains geometry — don't overwrite it!
    if "info" in doc and isinstance(doc["info"], dict):
        if kind != "Map":
            doc["info"]["data"] = True
            doc["blobs"] = ["info"]
    elif "info" not in doc:
        doc["info"] = {}

    # Ensure friends is a list (for User and Character)
    if kind in ("User", "Character") and "friends" not in doc:
        doc["friends"] = []

    return doc


# ==================== Main Migration ====================

def log(msg):
    print(msg, flush=True)

def main():
    log(f"Opening {RDBMS_PATH}...")
    conn = sqlite3.connect(RDBMS_PATH)
    cursor = conn.cursor()

    rows = cursor.execute(
        'SELECT kind, entity FROM "dev~twodimensionalgame!!Entities" ORDER BY kind'
    ).fetchall()
    log(f"Found {len(rows)} entities total")

    log(f"\nConnecting to MongoDB: {MONGO_DB}...")
    mongo = MongoClient(MONGO_URI)
    db = mongo[MONGO_DB]

    by_kind = {}
    for kind, entity_blob in rows:
        if kind.startswith("__"): continue
        if kind not in KIND_MAP:
            continue
        by_kind.setdefault(kind, []).append(entity_blob)

    total_upserted = 0

    for kind, blobs in sorted(by_kind.items()):
        collection_name = KIND_MAP[kind][1]
        docs = []
        errors = 0

        for blob in blobs:
            try:
                k, nid, sname, props = parse_entity(blob)
                doc = to_mongo_doc(k, nid, sname, props)
                if doc:
                    docs.append(doc)
                else:
                    errors += 1
            except Exception as e:
                errors += 1
                log(f"  ERROR parsing {kind}: {e}")

        if not docs:
            log(f"  {kind}: 0 docs")
            continue

        # Upsert all docs (replaces existing, inserts new)
        ops = [ReplaceOne({"_id": d["_id"]}, d, upsert=True) for d in docs]
        try:
            result = db[collection_name].bulk_write(ops, ordered=False)
            inserted = result.upserted_count
            modified = result.modified_count
            log(f"  {kind} → {collection_name}: {inserted} new, {modified} updated, {errors} errors (total {len(docs)})")
            total_upserted += inserted + modified
        except Exception as e:
            log(f"  ERROR upserting {kind}: {e}")

    log(f"\nDone! {total_upserted} total upserted")
    conn.close()
    mongo.close()

if __name__ == "__main__":
    main()
