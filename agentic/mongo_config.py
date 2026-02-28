"""Shared MongoDB config for agentic scripts.

Reads MongoDB credentials from secretsandconfig/*.js key files based on TARGET env var,
with environment variable overrides.

Environment variables:
  TARGET     — "dev" or "prod" (reads from keys.js / keys_production.js)
  MONGO_URI  — override full connection string
  MONGO_DB   — override database name

If TARGET is not set, falls back to MONGO_URI/MONGO_DB env vars with localhost defaults.
"""

import os
import re

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SECRETS_DIR = os.path.join(SCRIPT_DIR, "..", "secretsandconfig")


def _parse_js_keys(filename):
    """Extract MongoDB URI and DB name from a JS key file in secretsandconfig/."""
    filepath = os.path.join(SECRETS_DIR, filename)
    with open(filepath) as f:
        content = f.read()

    uri_match = re.search(r'mongodb_uri:\s*"([^"]+)"', content)
    name_match = re.search(r'mongodb_name:\s*"([^"]+)"', content)
    tls_match = re.search(r'tlsCAFile:\s*path\.resolve\(__dirname,\s*"([^"]+)"\)', content)

    uri = uri_match.group(1) if uri_match else ""
    db = name_match.group(1) if name_match else ""

    # Append tlsCAFile to URI if found in config and not already present
    if tls_match and uri and "&tlsCAFile=" not in uri:
        tls_file = os.path.join(SECRETS_DIR, tls_match.group(1))
        uri += "&tlsCAFile=" + tls_file

    return uri, db


_KEY_FILES = {"dev": "keys.js", "prod": "keys_production.js"}
TARGET = os.environ.get("TARGET", "")

if TARGET in _KEY_FILES:
    _uri, _db = _parse_js_keys(_KEY_FILES[TARGET])
    MONGO_URI = os.environ.get("MONGO_URI", _uri)
    MONGO_DB = os.environ.get("MONGO_DB", _db)
else:
    MONGO_URI = os.environ.get("MONGO_URI", "mongodb://127.0.0.1:27017/")
    MONGO_DB = os.environ.get("MONGO_DB", "adventureland")
