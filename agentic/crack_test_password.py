#!/usr/bin/env python3
"""
Try to find the raw password for test@test.com.
PBKDF2-SHA1, 160 iterations (very weak).

Known:
  hash: b5ca02c9a099b791192febbe62473b1f5168148380bb76c0
  salt: 6faEI0baimlHtc2I9XbVc
"""

import hashlib
import binascii

TARGET_HASH = "b5ca02c9a099b791192febbe62473b1f5168148380bb76c0"
SALT = "6faEI0baimlHtc2I9XbVc"
ITERATIONS = 160
# 48 hex chars = 24 bytes
DKLEN = 24


def hash_password(password, salt):
    """Replicate the game's hash_password function."""
    password = password.replace(" ", "").encode("utf-8")
    if isinstance(salt, str):
        salt = salt.encode("utf-8")
    dk = hashlib.pbkdf2_hmac("sha1", password, salt, ITERATIONS, dklen=DKLEN)
    return binascii.hexlify(dk).decode("ascii")


# Common test passwords to try
candidates = [
    "test", "test123", "test1234", "password", "123456", "12345678",
    "1234", "admin", "qwerty", "abc123", "letmein", "monkey", "dragon",
    "master", "111111", "password1", "123456789", "welcome", "login",
    "test@test.com", "testtest", "Test", "Test123", "TEST", "test!",
    "testing", "testing123", "tester", "pass", "pass123", "passw0rd",
    "1234567890", "000000", "iloveyou", "trustno1", "sunshine",
    "princess", "football", "shadow", "michael", "hello", "hello123",
    "GG2222", "gg2222", "warrior", "adventure", "adventureland",
    "steam", "gamer", "game", "play", "player",
    # Simple patterns
    "a", "aa", "aaa", "aaaa", "1", "12", "123", "1234", "12345",
    "qwer", "asdf", "zxcv", "qwerty123",
    # Turkish common
    "sifre", "sifre123", "deneme", "deneme123",
    "test1", "test12", "t", "tt", "ttt", "tttt",
]

print(f"Target hash: {TARGET_HASH}")
print(f"Salt: {SALT}")
print(f"Trying {len(candidates)} common passwords...\n")

for pw in candidates:
    h = hash_password(pw, SALT)
    if h == TARGET_HASH:
        print(f"FOUND! Password: '{pw}'")
        print(f"  Hash: {h}")
        break
else:
    print("Not found in common list.")
    print("\nTrying numeric range 0-99999...")
    for i in range(100000):
        pw = str(i)
        h = hash_password(pw, SALT)
        if h == TARGET_HASH:
            print(f"FOUND! Password: '{pw}'")
            print(f"  Hash: {h}")
            break
    else:
        print("Not found in numeric range either.")
        print("\nTrying lowercase alpha 1-4 chars...")
        import itertools
        import string
        for length in range(1, 5):
            for combo in itertools.product(string.ascii_lowercase, repeat=length):
                pw = "".join(combo)
                h = hash_password(pw, SALT)
                if h == TARGET_HASH:
                    print(f"FOUND! Password: '{pw}'")
                    print(f"  Hash: {h}")
                    break
            else:
                continue
            break
        else:
            print("Not found. May need a larger dictionary.")
