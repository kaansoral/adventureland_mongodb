#!/usr/bin/env python3
"""
Read a user's data and backups from Google Datastore (read-only).

Usage:
  python read_user_backups.py <email>
  python read_user_backups.py test@test.com
"""

import os
import sys
import pickle
import io
import pprint

from google.cloud import datastore

os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "..", "secretsandconfig", "twodimensionalgame_datastore_reader.json",
)

ds = datastore.Client(project="twodimensionalgame")


# ==================== Pickle Helpers ====================

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


def decode_value(key, val):
    if val is None:
        return None
    if isinstance(val, bytes):
        return safe_unpickle(val)
    return val


# ==================== Main ====================

def main():
    if len(sys.argv) < 2:
        print("Usage: python read_user_backups.py <email>")
        sys.exit(1)

    email = sys.argv[1]

    # 1. Find user by email
    print(f"=== Looking up user: {email} ===\n")
    query = ds.query(kind="User")
    query.add_filter(filter=datastore.query.PropertyFilter("email", "=", email))
    users = list(query.fetch(limit=5))

    if not users:
        print("User not found!")
        sys.exit(1)

    for user in users:
        user_id = str(user.key.id or user.key.name)
        print(f"--- User ID: {user_id} ---")

        # Print all fields
        for key in sorted(user.keys()):
            val = decode_value(key, user[key])
            if key == "password":
                print(f"  password: {val}")
            elif key == "info":
                print(f"  info:")
                if isinstance(val, dict):
                    for ik, iv in sorted(val.items()):
                        r = repr(iv)
                        if len(r) > 200:
                            r = r[:200] + "..."
                        print(f"    {ik}: {r}")
                else:
                    print(f"    {val}")
            else:
                r = repr(val)
                if len(r) > 200:
                    r = r[:200] + "..."
                print(f"  {key}: {r}")

        # 2. Look up backups for this user
        print(f"\n=== Backups for user|{user_id} ===\n")

        # Try backup_item_id = "user|{user_id}"
        query = ds.query(kind="Backup")
        query.add_filter(
            filter=datastore.query.PropertyFilter("backup_item_id", "=", f"user|{user_id}")
        )
        backups = list(query.fetch())
        print(f"Found {len(backups)} user backups")

        for i, backup in enumerate(backups):
            backup_id = backup.key.id or backup.key.name
            print(f"\n  --- Backup #{i+1} (ID: {backup_id}) ---")
            for key in sorted(backup.keys()):
                val = decode_value(key, backup[key])
                if key == "info":
                    print(f"    info:")
                    if isinstance(val, dict):
                        for ik, iv in sorted(val.items()):
                            r = repr(iv)
                            if len(r) > 200:
                                r = r[:200] + "..."
                            print(f"      {ik}: {r}")
                    else:
                        print(f"      {val}")
                elif key == "backup_info":
                    print(f"    backup_info:")
                    if isinstance(val, dict):
                        for ik, iv in sorted(val.items()):
                            r = repr(iv)
                            if len(r) > 200:
                                r = r[:200] + "..."
                            print(f"      {ik}: {r}")
                    else:
                        print(f"      {val}")
                else:
                    r = repr(val)
                    if len(r) > 200:
                        r = r[:200] + "..."
                    print(f"    {key}: {r}")

        # 3. Also check characters
        print(f"\n=== Characters for owner={user_id} ===\n")
        query = ds.query(kind="Character")
        query.add_filter(
            filter=datastore.query.PropertyFilter("owner", "=", user_id)
        )
        characters = list(query.fetch())
        print(f"Found {len(characters)} characters")

        for ch in characters:
            ch_id = str(ch.key.id or ch.key.name)
            info = decode_value("info", ch.get("info"))
            name = info.get("name", "?") if isinstance(info, dict) else "?"
            print(f"  {ch_id}: {name}")

    print("\nDone!")


if __name__ == "__main__":
    main()
