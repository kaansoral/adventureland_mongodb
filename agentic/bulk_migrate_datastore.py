#!/usr/bin/env python3
"""
Bulk migrate ALL entities from Google Datastore → MongoDB.

Copies entire Datastore kinds sequentially:
  User         → user collection        (US_ prefix)
  Character    → character collection   (CH_ prefix)
  InfoElement  → infoelement collection (IE_ prefix)
  MarkedPhrase → mark collection        (MK_ prefix)
  Mail         → mail collection        (ML_ prefix)
  Message      → message collection     (MS_ prefix)
  Map          → map collection         (MP_ prefix)

All IDs prefixed, info blobs unpickled, reference fields transformed.

Environment variables:
  DRY_RUN=1       (default) Preview only — fetch from Datastore, no MongoDB writes
  DRY_RUN=0       Actually write to MongoDB
  TARGET=prod     (default) Target production MongoDB (keys_production.js)
  TARGET=dev      Target development MongoDB (keys.js)
  BATCH_SIZE=500  Bulk write batch size (default 500)
  REPORT_EVERY=500  Progress report interval (default 500)

Usage:
  python bulk_migrate_datastore.py                           # dry run, prod
  TARGET=dev python bulk_migrate_datastore.py                # dry run, dev
  DRY_RUN=0 TARGET=dev python bulk_migrate_datastore.py      # live, dev
  DRY_RUN=0 python bulk_migrate_datastore.py                 # live, prod
"""

import os
import sys
import re
import pickle
import io
import datetime
import time

# ─── Set defaults before importing config ────────────────────────────────────

if "TARGET" not in os.environ:
    os.environ["TARGET"] = "prod"

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SECRETS_DIR = os.path.join(SCRIPT_DIR, "..", "secretsandconfig")

os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = os.path.join(
    SECRETS_DIR, "twodimensionalgame_datastore_reader.json",
)

from mongo_config import MONGO_URI, MONGO_DB, TARGET

from google.cloud import datastore
from pymongo import MongoClient, ReplaceOne

# ─── Configuration ───────────────────────────────────────────────────────────

DRY_RUN = os.environ.get("DRY_RUN", "1") == "1"
BATCH_SIZE = int(os.environ.get("BATCH_SIZE", "500"))
REPORT_EVERY = int(os.environ.get("REPORT_EVERY", "500"))
ONLY_KIND = os.environ.get("ONLY_KIND", "")  # e.g. "Message" to run just one kind

# ─── Kind → (collection, prefix) mapping ─────────────────────────────────────

KINDS = [
    ("Map",          "map",         "MP_"),
    ("User",         "user",        "US_"),
    ("Character",    "character",   "CH_"),
    ("InfoElement",  "infoelement", "IE_"),
    ("MarkedPhrase", "mark",        "MK_"),
    ("Mail",         "mail",        "ML_"),
    ("Message",      "message",     "MS_"),  # largest (~6M) — last so you can switch before it finishes
]

SKIP_PROPS = {"has_scatter", "__scatter__", "blobs"}
USER_REF_FIELDS = {"owner", "referrer"}
GUILD_REF_FIELDS = {"guild"}
USER_LIST_FIELDS = {"friends"}
MAX_GENERIC_SLOT = 100


# ─── Pickle helpers ──────────────────────────────────────────────────────────


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
    """Recursively convert GG objects to plain dicts."""
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
            return None
    if isinstance(obj, int) and (obj > 2**63 - 1 or obj < -(2**63)):
        return str(obj)
    return obj


def safe_unpickle(blob):
    """Try multiple strategies to unpickle a blob."""
    for enc in [None, "latin-1", "bytes"]:
        try:
            kwargs = {"encoding": enc} if enc else {}
            return gg_to_dict(MockUnpickler(io.BytesIO(blob), **kwargs).load())
        except Exception:
            pass
    return None


# ─── Conversion helpers ──────────────────────────────────────────────────────


def normalize_datetime(val):
    if hasattr(val, "timestamp"):
        return datetime.datetime.fromtimestamp(
            val.timestamp(), tz=datetime.timezone.utc
        ).replace(tzinfo=None)
    return val


def convert_value(key, val):
    if val is None:
        return None
    if hasattr(val, "timestamp"):
        return normalize_datetime(val)
    if isinstance(val, bytes):
        return safe_unpickle(val)
    return val


def prefix_id(val, prefix):
    if val is None:
        return None
    s = str(val)
    return s if s.startswith(prefix) else prefix + s


def prefix_user_id(val):
    return prefix_id(val, "US_")


def prefix_char_id(val):
    return prefix_id(val, "CH_")


def prefix_guild_id(val):
    return prefix_id(val, "GU_")


def fix_ie_key_name(key_name):
    """Fix InfoElement key name: add US_/CH_ prefixes to userdata/USERCODE keys."""
    # userdata-{bare_numeric_id} → userdata-US_{id}
    m = re.match(r"^userdata-(\d+)$", key_name)
    if m:
        return f"userdata-US_{m.group(1)}"

    # USERCODE-{bare_numeric_id}-{slot} → USERCODE-US_{id}-{slot_with_CH_}
    m = re.match(r"^USERCODE-(\d+)-(.+)$", key_name)
    if m:
        user_id = f"US_{m.group(1)}"
        slot = m.group(2)
        try:
            if int(slot) > MAX_GENERIC_SLOT:
                slot = f"CH_{slot}"
        except (ValueError, TypeError):
            pass
        return f"USERCODE-{user_id}-{slot}"

    return key_name


def fix_info_ids(info):
    """Prefix numeric IDs inside info dict (characters, code_list)."""
    for ch in info.get("characters", []):
        if isinstance(ch, dict):
            if "id" in ch:
                cid = str(ch["id"])
                if cid and not cid.startswith("CH_"):
                    ch["id"] = "CH_" + cid
            if "server" in ch:
                srv = str(ch["server"])
                if srv and not srv.startswith("SR_"):
                    ch["server"] = "SR_" + srv

    code_list = info.get("code_list")
    if isinstance(code_list, dict):
        new_code_list = {}
        for slot, val in code_list.items():
            if slot == "NaN":
                continue
            new_slot = slot
            try:
                if int(slot) > MAX_GENERIC_SLOT:
                    new_slot = "CH_" + slot
            except (ValueError, TypeError):
                pass
            new_code_list[new_slot] = val
        info["code_list"] = new_code_list


# ─── Entity conversion ───────────────────────────────────────────────────────


def convert_entity(entity, kind):
    """Convert a Datastore entity to a MongoDB document with proper prefixes."""
    eid = entity.key.name or entity.key.id
    if eid is None:
        return None

    # Build _id
    if kind == "InfoElement":
        doc = {"_id": "IE_" + fix_ie_key_name(str(eid))}
    else:
        prefix = {k: p for k, _, p in KINDS}[kind]
        doc = {"_id": prefix + str(eid)}

    for key, val in entity.items():
        if key in SKIP_PROPS:
            continue

        # MarkedPhrase: owner prefix depends on mark type
        if kind == "MarkedPhrase" and key == "owner":
            key_name = str(entity.key.name or "")
            if key_name.startswith("character-"):
                doc[key] = prefix_char_id(val) if val else None
            elif key_name.startswith("guild-"):
                doc[key] = prefix_guild_id(val) if val else None
            else:
                doc[key] = prefix_user_id(val) if val else None
            continue

        # Message.owner with ~ prefix: server-owned messages
        if kind == "Message" and key == "owner" and isinstance(val, str) and val.startswith("~"):
            if val == "~global":
                doc[key] = val
            else:
                doc[key] = "~SR_" + val[1:]  # ~EUI → ~SR_EUI
            continue

        # Reference fields → US_ prefix (handles repeated/list values like Mail.owner)
        if key in USER_REF_FIELDS:
            if isinstance(val, list):
                doc[key] = [prefix_user_id(v) for v in val if v]
            else:
                doc[key] = prefix_user_id(val) if val else None
            continue

        # Guild field → GU_ prefix
        if key in GUILD_REF_FIELDS:
            doc[key] = prefix_guild_id(val) if val else None
            continue

        # Friends → list of US_ prefixed IDs
        if key in USER_LIST_FIELDS:
            if isinstance(val, list):
                doc[key] = [prefix_user_id(fid) for fid in val if fid]
            elif val:
                doc[key] = [prefix_user_id(val)]
            else:
                doc[key] = []
            continue

        # Server field → SR_ prefix
        if key == "server":
            if val and isinstance(val, str) and val.strip():
                doc[key] = prefix_id(val, "SR_")
            else:
                doc[key] = val
            continue

        # Email (repeated in Datastore → string in MongoDB)
        if key == "email":
            if isinstance(val, list):
                doc[key] = val[0] if val else ""
            else:
                doc[key] = val
            continue

        # General conversion
        doc[key] = convert_value(key, val)

    # Ensure defaults
    if kind in ("User", "Character") and "friends" not in doc:
        doc["friends"] = []
    if "info" not in doc:
        doc["info"] = {}
    if isinstance(doc.get("info"), dict):
        fix_info_ids(doc["info"])
        # Strip RDBMS blob marker artifact
        if doc["info"].get("data") is True:
            del doc["info"]["data"]

    # Force offline state for migrated User/Character entities
    if kind in ("User", "Character"):
        doc["server"] = ""
        doc["online"] = False

    return doc


# ─── Bulk migration per kind ─────────────────────────────────────────────────


def migrate_kind(ds, db, kind, collection, prefix, kind_index, total_kinds):
    """Migrate all entities of a Datastore kind to MongoDB."""
    t0 = time.time()
    print(f"\n{'=' * 60}")
    print(f"  [{kind_index}/{total_kinds}] {kind} → {collection} (prefix: {prefix})")
    print(f"{'=' * 60}")
    print(f"  Querying Datastore for all {kind} entities...")

    query = ds.query(kind=kind)
    # Optional: filter Message entities by type (e.g. MESSAGE_TYPE=private)
    msg_type = os.environ.get("MESSAGE_TYPE", "")
    if kind == "Message" and msg_type:
        query.add_filter("type", "=", msg_type)
        print(f"  Filter: type={msg_type}")
    count = 0
    errors = 0
    batch = []
    samples = []

    for entity in query.fetch():
        count += 1

        try:
            doc = convert_entity(entity, kind)
            if doc is None:
                errors += 1
                print(f"  [SKIP] Entity #{count}: no ID found")
                continue
        except Exception as e:
            errors += 1
            eid = entity.key.name or entity.key.id
            print(f"  [ERROR] Entity #{count} ({kind} {eid}): {e}")
            continue

        # Collect first 3 samples for display
        if len(samples) < 3:
            sample_label = doc["_id"]
            if kind == "User":
                sample_label += f" ({doc.get('email', '?')})"
            elif kind == "Character":
                name = doc.get("info", {}).get("name", doc.get("name", "?"))
                sample_label += f" ({name})"
            elif kind == "Mail":
                subj = doc.get("info", {}).get("subject", "?")
                sample_label += f" ({subj})"
            samples.append(sample_label)

        if not DRY_RUN:
            batch.append(ReplaceOne({"_id": doc["_id"]}, doc, upsert=True))
            if len(batch) >= BATCH_SIZE:
                db[collection].bulk_write(batch)
                batch = []

        # Progress report
        if count % REPORT_EVERY == 0:
            elapsed = time.time() - t0
            rate = count / elapsed if elapsed > 0 else 0
            print(f"  ... {count:,} entities processed ({rate:.0f}/sec, {elapsed:.1f}s)")

    # Flush remaining batch
    if batch and not DRY_RUN:
        db[collection].bulk_write(batch)

    # Print samples
    if samples:
        print(f"  Samples:")
        for s in samples:
            print(f"    {s}")

    elapsed = time.time() - t0
    rate = count / elapsed if elapsed > 0 else 0
    mode = "DRY RUN" if DRY_RUN else "MIGRATED"
    error_str = f", {errors} errors" if errors else ""
    print(f"  [{mode}] {kind}: {count:,} entities{error_str} ({elapsed:.1f}s, {rate:.0f}/sec)")

    return count, errors


# ─── Main ─────────────────────────────────────────────────────────────────────


def main():
    print("=" * 60)
    print("  BULK DATASTORE → MONGODB MIGRATION")
    print("=" * 60)
    print(f"  Target:       {TARGET} ({MONGO_DB})")
    print(f"  Mode:         {'DRY RUN (no writes)' if DRY_RUN else '*** LIVE (writing to MongoDB!) ***'}")
    print(f"  Batch size:   {BATCH_SIZE}")
    print(f"  Report every: {REPORT_EVERY}")
    run_kinds_preview = [(k, c, p) for k, c, p in KINDS if not ONLY_KIND or k == ONLY_KIND]
    print(f"  Kinds:        {', '.join(k for k, _, _ in run_kinds_preview)}")
    if os.environ.get("MESSAGE_TYPE"):
        print(f"  Message filter: type={os.environ['MESSAGE_TYPE']}")
    print("=" * 60)

    if not DRY_RUN:
        print("\n  *** WARNING: This will WRITE to MongoDB! ***")
        print("  Press Ctrl+C within 5 seconds to abort...")
        try:
            time.sleep(5)
        except KeyboardInterrupt:
            print("\n  Aborted.")
            sys.exit(0)

    # Connect to Datastore
    print("\nConnecting to Google Datastore (project: twodimensionalgame)...")
    ds = datastore.Client(project="twodimensionalgame")
    print("  [OK] Datastore client ready")

    # Connect to MongoDB
    print(f"\nConnecting to MongoDB ({TARGET}: {MONGO_DB})...")
    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=10000)
        db = client[MONGO_DB]
        db.command("ping")
        print(f"  [OK] MongoDB connected: {MONGO_DB}")
    except Exception as e:
        if DRY_RUN:
            print(f"  [WARN] MongoDB connection failed: {e}")
            print(f"  Continuing dry run without MongoDB...")
            db = None
        else:
            print(f"  [FATAL] MongoDB connection failed: {e}")
            sys.exit(1)

    # Migrate each kind
    t_total = time.time()
    totals = {}

    run_kinds = [(k, c, p) for k, c, p in KINDS if not ONLY_KIND or k == ONLY_KIND]
    if not run_kinds:
        print(f"\n  [FATAL] ONLY_KIND={ONLY_KIND!r} not found in KINDS list")
        sys.exit(1)

    for i, (kind, collection, prefix) in enumerate(run_kinds, 1):
        count, errors = migrate_kind(ds, db, kind, collection, prefix, i, len(run_kinds))
        totals[kind] = (count, errors)

    # Summary
    total_time = time.time() - t_total
    mode = "DRY RUN" if DRY_RUN else "LIVE"
    print(f"\n{'=' * 60}")
    print(f"  MIGRATION SUMMARY ({mode})")
    print(f"{'=' * 60}")
    grand_total = 0
    grand_errors = 0
    for kind, collection, prefix in run_kinds:
        count, errors = totals[kind]
        grand_total += count
        grand_errors += errors
        err_str = f" ({errors} errors)" if errors else ""
        print(f"  {kind:15s} → {collection:15s}: {count:>8,} entities{err_str}")
    print(f"  {'─' * 52}")
    print(f"  {'TOTAL':15s}                    {grand_total:>8,} entities")
    if grand_errors:
        print(f"  {'ERRORS':15s}                    {grand_errors:>8,}")
    print(f"  Time: {total_time:.1f}s")
    print(f"{'=' * 60}")

    if DRY_RUN:
        print(f"\n  This was a DRY RUN. No data was written to MongoDB.")
        print(f"  To run for real: DRY_RUN=0 python {os.path.basename(__file__)}")


if __name__ == "__main__":
    main()
