Rules:

- Never expose keys and passwords anywhere, load them dynamically from secretsandconfig. Never put exposed keys or key files in /agentic
- Don't remove or change features without explicit permission while refactoring, this is a live game's development server!
- Don't edit files from parent folders, only reference them
- Don't edit files from symlinked folders, unless explicit permission is given. /common is sacred.
- For agentic tasks and scripts, use the /agentic folder, keep your scripts for future repetitions / improvements. Don't clutter the main files.
- Project will be open source, if you are going to use private keys or api keys, place them in /secretsandconfig and read from there.
- Even if bypass permissions is on, be delicate, clarify your plan whenever you can and ask for permission!
- /agentic folder is for Agent scripts, you should only use this folder for the scripts you are working on. Never add one time scripts into actual code!

The original game is at ~/thegame - you can reference but never edit it.
After task completion, if files are changed, commit your work to git

Data transfer / normalization notes: (note every gotcha and every little detail here, keep it updated Claude)

Sources:

- SQLite RDBMS (`~/Desktop/PROJECTS/thegame/storage/db.rdbms`) — local AppEngine dev server dump, migrated via `agentic/_migrate_rdbms.py`
- Google Datastore (project: `twodimensionalgame`) — live production data, accessed via service account `agentic/twodimensionalgame_datastore_reader.json`
- MongoDB (adventuredev) — target database

ID mapping:

- RDBMS and Datastore use different numeric IDs for the same entities (different ID spaces!)
- Example: kaansoral@gmail.com is `5818821692620800` in RDBMS but `5752754626625536` in Datastore
- MongoDB IDs get prefixed: US*=user, CH*=character, GU*=guild, PT*=pet, SR*=server, MS*=message, ML*=mail, EV*=event, IE*=infoelement, UL*=upload, IP*=ip, MK*=mark, BC*=backup, MP*=map
- Duplicate users can exist if imported from both sources (e.g. test@test.com had two entries with different IDs and different passwords)

Password hashing:

- Algorithm: PBKDF2-SHA1, 160 iterations, 24-byte key (48 hex chars)
- Salt stored in `user.info.salt` (20-char random string)
- Spaces stripped from password before hashing: `password.replace(/ /g, "")`
- `gf(user, "salt", "5")` falls back to salt="5" for legacy users without salt
- Password stored as hex string on user.password

user_data (code_list, tutorial, mail count):

- `code_list` is NOT on the User entity — it lives on a separate InfoElement with key `userdata-{user_id}`
- Runtime does: `get("IE_userdata-" + user._id)` where user._id = "US_xxx" → so key must be `IE_userdata-US_{numeric_id}`
- CRITICAL: RDBMS migration originally created `IE_userdata-{numeric_id}` (missing US\_ prefix) — runtime couldn't find them, auto-created empty/corrupted ones. Fixed by `reimport_userdata_from_sqlite.py`
- code_list is a dict: `{slot_number: [filename, version]}` — slot keys are strings of integers (character IDs or small numbers)
- USERCODE stored separately: `InfoElement` key `USERCODE-{user_id}-{slot}` with `info.code` containing the actual code

RDBMS migration gotchas (agentic/\_migrate_rdbms.py):

- Protobuf parser uses `props[pname] = val` which OVERWRITES on repeated fields — only last value survives (friends became a single string instead of array, fixed by `fix_repeated_properties.py`)
- InfoElement keys need entity prefix: `IE_userdata-US_{id}`, `IE_USERCODE-US_{id}-{slot}` — the runtime constructs keys using `user._id` which has the US\_ prefix
- `info.data = True` was incorrectly added as a blob marker — cleaned up by `_fix_info_data_true.py`
- `blobs` field was added as reference metadata — cleaned up by `fix_remove_blobs_field.py`

Datastore import gotchas (agentic/import_from_datastore.py):

- `email` is a repeated property (list) in Datastore — must flatten to string for MongoDB
- `info` field is a PickleProperty (bytes) — must unpickle with MockUnpickler that handles GG class and Python 2 pickles
- Pickle contains GG objects (from `config.GG`) — need mock class + recursive conversion to plain dicts
- Some pickles need `encoding="latin-1"` for Python 2 compatibility
- Character IDs inside `info.characters[].id` need CH\_ prefix (fixed by `fix_info_character_ids.py`)
- Reference fields (owner, referrer) need US* prefix; guild needs GU* prefix
- friends field needs to be an array of US\_-prefixed IDs

Runtime gotchas:

- `normalize_user_id()` in adventure*functions.js prepends US* to bare numeric IDs — used in cookie parsing for old Datastore sessions
- `get_referrer()` in api.js can receive unprefixed numeric IDs from ip.referrer — must use normalize_user_id()
- `has_scatter` / `__scatter__` are Datastore internal properties — skip during import
- DatetimeWithNanoseconds from Datastore needs conversion to plain datetime for MongoDB
- `api_call()` in common/js/common_functions.js uses Promise pattern — does NOT support r_args.success callback (old thegame pattern). Use `.then()` on the returned promise instead
- Server-side delete_cookie handles domain/path/secure correctly for both HTTP and HTTPS — always prefer api_call('logout') over client-side Cookies.remove() which breaks on HTTPS
- Python venv for Datastore/MongoDB scripts: `agentic/.venv` (has google-cloud-datastore, pymongo)

Code system slot IDs:

- Slots are STRING keys, not integers — can be "CH_xxx" (character-specific) or "1"-"100" (generic)
- Never parseInt() a slot to use as a code_list key — use string comparison
- USERCODE entity key format: IE_USERCODE-{user_id}-{slot} where slot can be "CH_xxx"
- info.characters[].id uses CH\_ prefix (matches character.\_id) — this is correct
- When refactoring any code that handles entity IDs: use string comparison, not parseInt

Fix scripts already run:

- `fix_repeated_properties.py` — friends string→array, prefix numeric IDs with US\_
- `fix_remove_blobs_field.py` — remove blobs field from all collections
- `_fix_info_data_true.py` — remove info.data=true from all collections
- `fix_info_character_ids.py` — prefix info.characters[].id with CH\_
- `reimport_userdata_from_sqlite.py` — re-import userdata with correct US\_ prefix keys, delete old wrong-key docs
- `fix_nan_code_slots.py` — remove NaN code*list entries and IE_USERCODE-\*-NaN docs (caused by parseInt on CH* IDs)
