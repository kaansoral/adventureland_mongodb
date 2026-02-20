#!/usr/bin/env python3
"""
Proof of concept: Query Google Datastore for first 20 users (2 pages of 10).
Project: twodimensionalgame
"""

import os
import pickle
from google.cloud import datastore

# Auth
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "..", "secretsandconfig", "twodimensionalgame_datastore_reader.json",
)

client = datastore.Client(project="twodimensionalgame")


def get_email(user):
    """Extract email from a User entity, unpickling info if needed."""
    # Try top-level email first
    email = user.get("email")
    if email and not isinstance(email, bytes):
        return email

    # Try unpickling the info field
    info = user.get("info")
    if isinstance(info, bytes):
        try:
            info_data = pickle.loads(info)
            if isinstance(info_data, dict):
                return info_data.get("email", "N/A")
        except Exception as e:
            return f"(pickle error: {e})"

    if isinstance(info, dict):
        return info.get("email", "N/A")

    return "N/A"


# Page 1: first 10 users
print("=== Page 1 (first 10 users) ===")
query = client.query(kind="User")
query.order = ["created"]
page1_iter = query.fetch(limit=10)
page1 = list(page1_iter)

for i, user in enumerate(page1):
    key_id = user.key.id or user.key.name
    email = get_email(user)
    created = user.get("created", "N/A")
    print(f"  {i+1}. key={key_id}  email={email}  created={created}")

# Page 2: next 10 users using cursor
cursor = page1_iter.next_page_token
if cursor:
    print("\n=== Page 2 (next 10 users) ===")
    query2 = client.query(kind="User")
    query2.order = ["created"]
    page2_iter = query2.fetch(limit=10, start_cursor=cursor)
    page2 = list(page2_iter)

    for i, user in enumerate(page2):
        key_id = user.key.id or user.key.name
        email = get_email(user)
        created = user.get("created", "N/A")
        print(f"  {i+11}. key={key_id}  email={email}  created={created}")
else:
    print("\nNo more pages (fewer than 10 users total)")

print("\nDone.")
