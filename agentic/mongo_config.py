"""Shared MongoDB config for agentic scripts.

Reads from environment variables with local defaults:
  MONGO_URI  — full connection string (default: mongodb://127.0.0.1:27017/)
  MONGO_DB   — database name (default: adventureland)
"""

import os

MONGO_URI = os.environ.get("MONGO_URI", "mongodb://127.0.0.1:27017/")
MONGO_DB = os.environ.get("MONGO_DB", "adventureland")
