#!/usr/bin/env python3
"""
Fix USERCODE entity key format in MongoDB.

The RDBMS migration created USERCODE entities with bare numeric IDs:
  IE_USERCODE-5818821692620800-2          (wrong)

But the runtime constructs keys with US_ prefix:
  IE_USERCODE-US_5818821692620800-2       (correct)

Similarly, character-specific slots used bare numeric character IDs:
  IE_USERCODE-5818821692620800-5629499534213120    (wrong)

But should use CH_ prefix:
  IE_USERCODE-US_5818821692620800-CH_5629499534213120  (correct)

This also updates the corresponding code_list keys in IE_userdata-US_{user_id}
when a slot is re-keyed from bare numeric to CH_ prefixed.

Same bug pattern as IE_userdata (fixed by reimport_userdata_from_sqlite.py).

Usage:
  DRY_RUN=1 python fix_usercode_keys.py   # preview changes
  python fix_usercode_keys.py              # apply fixes
"""

import os
import re
from pymongo import MongoClient

from mongo_config import MONGO_URI, MONGO_DB

DRY_RUN = os.environ.get("DRY_RUN", "0") == "1"

# Slot numbers 1-100 are generic slots; anything above 100 is an old-format character ID
MAX_GENERIC_SLOT = 100


def main():
    client = MongoClient(MONGO_URI)
    db = client[MONGO_DB]
    ie_col = db["infoelement"]

    if DRY_RUN:
        print("=== DRY RUN MODE ===\n")

    # Find all USERCODE entities
    all_usercodes = list(ie_col.find({"_id": {"$regex": r"^IE_USERCODE-"}}))
    print(f"Found {len(all_usercodes)} total IE_USERCODE-* documents\n")

    # Parse each key: IE_USERCODE-{user_part}-{slot_part}
    # Key format: IE_USERCODE-<user_id>-<slot>
    # user_id can be: bare numeric (wrong) or US_xxxx (correct)
    # slot can be: "1"-"100" (generic), bare numeric > 100 (wrong char ID), or "CH_xxx" (correct)
    rekey_count = 0
    skip_count = 0
    already_correct = 0
    errors = 0
    code_list_fixes = 0

    for doc in all_usercodes:
        old_id = doc["_id"]

        # Parse: strip "IE_USERCODE-" prefix, then split on first "-" for user, rest for slot
        # But user_id might contain "US_" which has no dash, and slot might be "CH_xxx"
        # Format is: IE_USERCODE-{user_id}-{slot}
        # We need to handle:
        #   IE_USERCODE-12345-2              (bare user, generic slot)
        #   IE_USERCODE-12345-67890          (bare user, bare char slot)
        #   IE_USERCODE-US_12345-2           (correct user, generic slot)
        #   IE_USERCODE-US_12345-CH_67890    (correct user, correct char slot)

        after_prefix = old_id[len("IE_USERCODE-"):]

        # Detect if user_id starts with US_
        if after_prefix.startswith("US_"):
            # User part is US_xxx, find the next dash after US_
            rest = after_prefix[len("US_"):]
            dash_pos = rest.find("-")
            if dash_pos == -1:
                print(f"  ERROR: Can't parse slot from {old_id}")
                errors += 1
                continue
            user_id = "US_" + rest[:dash_pos]
            slot = rest[dash_pos + 1:]
        else:
            # Bare numeric user ID
            dash_pos = after_prefix.find("-")
            if dash_pos == -1:
                print(f"  ERROR: Can't parse slot from {old_id}")
                errors += 1
                continue
            bare_user = after_prefix[:dash_pos]
            user_id = "US_" + bare_user
            slot = after_prefix[dash_pos + 1:]

        # Check if slot needs CH_ prefix
        new_slot = slot
        if slot.startswith("CH_"):
            pass  # already correct
        else:
            try:
                slot_num = int(slot)
                if slot_num > MAX_GENERIC_SLOT:
                    new_slot = "CH_" + slot
            except ValueError:
                # Non-numeric, non-CH_ slot (e.g. "NaN" handled by other script)
                pass

        new_id = f"IE_USERCODE-{user_id}-{new_slot}"

        if new_id == old_id:
            already_correct += 1
            continue

        print(f"  {old_id} -> {new_id}")

        if not DRY_RUN:
            # Create new doc with corrected key
            new_doc = dict(doc)
            new_doc["_id"] = new_id
            try:
                ie_col.insert_one(new_doc)
            except Exception as e:
                if "duplicate key" in str(e).lower():
                    # Already exists with the correct key — just replace
                    ie_col.replace_one({"_id": new_id}, new_doc)
                else:
                    print(f"    ERROR inserting {new_id}: {e}")
                    errors += 1
                    continue

            # Delete old doc
            ie_col.delete_one({"_id": old_id})

        rekey_count += 1

        # If slot was re-keyed (bare numeric -> CH_), also fix code_list in userdata
        if new_slot != slot:
            userdata_id = f"IE_userdata-{user_id}"
            userdata = ie_col.find_one({"_id": userdata_id})
            if userdata:
                code_list = userdata.get("info", {}).get("code_list", {})
                if slot in code_list and new_slot not in code_list:
                    print(f"    Also fixing code_list: slot {slot!r} -> {new_slot!r} in {userdata_id}")
                    if not DRY_RUN:
                        # Rename the key in code_list
                        ie_col.update_one(
                            {"_id": userdata_id},
                            {
                                "$set": {f"info.code_list.{new_slot}": code_list[slot]},
                                "$unset": {f"info.code_list.{slot}": ""},
                            },
                        )
                    code_list_fixes += 1

    print(f"\nSummary:")
    print(f"  Re-keyed: {rekey_count}")
    print(f"  Already correct: {already_correct}")
    print(f"  Code list slot fixes: {code_list_fixes}")
    print(f"  Errors: {errors}")
    print(f"  Total processed: {len(all_usercodes)}")

    if DRY_RUN:
        print("\n(No changes made — run without DRY_RUN=1 to apply)")

    client.close()
    print("Done!")


if __name__ == "__main__":
    main()
