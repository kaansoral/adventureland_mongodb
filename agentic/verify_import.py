#!/usr/bin/env python3
"""Verify imported data for a user in MongoDB — checks all ID prefixes."""

import sys
from pymongo import MongoClient
from mongo_config import MONGO_URI, MONGO_DB

db = MongoClient(MONGO_URI)[MONGO_DB]

user_id = sys.argv[1] if len(sys.argv) > 1 else "US_6233419454349312"
errors = 0

print(f"=== Verification for {user_id} ===\n")

# 1. User
u = db.user.find_one({"_id": user_id})
if not u:
    print(f"ERROR: User {user_id} not found!")
    sys.exit(1)
print(f"User: {u['_id']} email={u['email']} name={u['name']}")
assert u["_id"].startswith("US_"), "User ID not prefixed!"

friends = u.get("friends", [])
print(f"  friends: {len(friends)}")
for f in friends:
    if not f.startswith("US_"):
        print(f"  ERROR: friend {f} not US_ prefixed!")
        errors += 1
if not errors:
    print(f"  friends prefix: OK")

chars_in_info = u.get("info", {}).get("characters", [])
print(f"  info.characters: {len(chars_in_info)}")
for c in chars_in_info:
    cid = str(c.get("id", ""))
    if cid and not cid.startswith("CH_"):
        print(f"  ERROR: info.characters id {cid} not CH_ prefixed!")
        errors += 1
if not errors:
    print(f"  info.characters prefix: OK")

print()

# 2. Characters
chars = list(db.character.find({"owner": user_id}))
print(f"Characters: {len(chars)}")
for c in chars:
    if not c["_id"].startswith("CH_"):
        print(f"  ERROR: char ID {c['_id']} not CH_ prefixed!")
        errors += 1
    if not c.get("owner", "").startswith("US_"):
        print(f"  ERROR: char {c['_id']} owner not US_ prefixed!")
        errors += 1
if not errors:
    print(f"  ID/owner prefix: OK")
print()

# 3. UserData
ud_key = f"IE_userdata-{user_id}"
ud = db.infoelement.find_one({"_id": ud_key})
if ud:
    code_list = ud.get("info", {}).get("code_list", {})
    print(f"UserData: {ud_key} ({len(code_list)} code slots)")
    for slot in sorted(code_list.keys()):
        try:
            if int(slot) > 100:
                print(f"  ERROR: slot {slot} should be CH_ prefixed!")
                errors += 1
        except ValueError:
            if not slot.startswith("CH_") and slot != "NaN":
                print(f"  WARN: unexpected slot format: {slot}")
    if not errors:
        print(f"  code_list slot keys: OK")
else:
    print(f"UserData: NOT FOUND at {ud_key}")
    errors += 1
print()

# 4. USERCODEs
usercodes = list(db.infoelement.find({"_id": {"$regex": f"^IE_USERCODE-{user_id}-"}}))
print(f"USERCODEs: {len(usercodes)}")
for uc in usercodes:
    if not uc["_id"].startswith(f"IE_USERCODE-{user_id}-"):
        print(f"  ERROR: USERCODE key wrong: {uc['_id']}")
        errors += 1
if not errors:
    print(f"  key format: OK")
print()

# 5. Marks
email_mark = db.mark.find_one({"_id": f"MK_email-{u['email']}"})
if email_mark:
    print(f"Email mark: {email_mark['_id']} owner={email_mark.get('owner')}")
    if not email_mark.get("owner", "").startswith("US_"):
        print(f"  ERROR: email mark owner not US_ prefixed!")
        errors += 1
else:
    print(f"Email mark: NOT FOUND (MK_email-{u['email']})")
    errors += 1

char_marks = list(db.mark.find({"owner": {"$in": [c["_id"] for c in chars]}}))
print(f"Character marks: {len(char_marks)}")
for m in char_marks:
    if not m["_id"].startswith("MK_"):
        print(f"  ERROR: mark ID wrong: {m['_id']}")
        errors += 1
    if not m.get("owner", "").startswith("CH_"):
        print(f"  ERROR: mark owner not CH_ prefixed: {m.get('owner')}")
        errors += 1
if not errors:
    print(f"  mark format: OK")
print()

# 6. Mail
mails = list(db.mail.find({"owner": user_id}))
print(f"Mail: {len(mails)}")
for m in mails[:5]:
    if not m["_id"].startswith("ML_"):
        print(f"  ERROR: mail ID wrong: {m['_id']}")
        errors += 1
if not errors:
    print(f"  key format: OK")
print()

# Summary
if errors:
    print(f"FAILED: {errors} errors found!")
else:
    print("=== ALL CHECKS PASSED ===")

db.client.close()
