#!/usr/bin/env python3
"""
Diagnostic: Check what Map entity pickles contain in db.rdbms
"""
import sqlite3, pickle, struct, io, datetime, sys, os, json

RDBMS_PATH = "/Users/kaan/Desktop/PROJECTS/thegame/storage/db.rdbms"

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
            return "<bytes>"
    if isinstance(obj, int) and (obj > 2**63 - 1 or obj < -(2**63)):
        return str(obj)
    if isinstance(obj, datetime.datetime):
        return str(obj)
    return obj

def unpickle_blob(blob):
    for enc in [None, "latin-1", "bytes"]:
        try:
            kwargs = {"encoding": enc} if enc else {}
            obj = MockUnpickler(io.BytesIO(blob), **kwargs).load()
            return gg_to_dict(obj)
        except Exception:
            pass
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


def main():
    conn = sqlite3.connect(RDBMS_PATH)
    cursor = conn.cursor()

    rows = cursor.execute(
        'SELECT kind, entity FROM "dev~twodimensionalgame!!Entities" WHERE kind="Map" ORDER BY kind'
    ).fetchall()
    print(f"Found {len(rows)} Map entities\n")

    for i, (kind, blob) in enumerate(rows):
        k, nid, sname, props = parse_entity(blob)
        entity_id = sname or str(nid)
        print(f"=== Map: {entity_id} ===")

        if "info" in props:
            info = props["info"]
            if isinstance(info, dict):
                print(f"  info type: dict, keys: {list(info.keys())}")
                if "data" in info:
                    data = info["data"]
                    if isinstance(data, dict):
                        print(f"  info.data type: dict, keys: {list(data.keys())}")
                        for key in data:
                            val = data[key]
                            if isinstance(val, list):
                                print(f"    {key}: list[{len(val)}]")
                            elif isinstance(val, dict):
                                print(f"    {key}: dict[{len(val)}]")
                            else:
                                print(f"    {key}: {type(val).__name__} = {val}")
                    else:
                        print(f"  info.data type: {type(data).__name__} = {data}")
                else:
                    print(f"  info has NO 'data' key")
                    # Show what's in info directly
                    for key in list(info.keys())[:10]:
                        val = info[key]
                        if isinstance(val, list):
                            print(f"    {key}: list[{len(val)}]")
                        elif isinstance(val, dict):
                            print(f"    {key}: dict[{len(val)}]")
                        else:
                            print(f"    {key}: {type(val).__name__} = {str(val)[:80]}")
            elif info is None:
                print(f"  info: None (unpickle failed)")
            else:
                print(f"  info type: {type(info).__name__}")
        else:
            print(f"  NO info property!")

        print()
        if i >= 5:  # Show first 6 for diagnosis
            print(f"... ({len(rows) - i - 1} more)")
            break

    conn.close()

if __name__ == "__main__":
    main()
