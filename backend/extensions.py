from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

import os

import os

# Persistent storage for limiter (Temporarily set to memory for cloud stability)
LIMITER_DB_URI = "memory://"

limiter = Limiter(
    get_remote_address,
    default_limits=["5000 per day", "2000 per hour"],
    storage_uri=LIMITER_DB_URI,
)
