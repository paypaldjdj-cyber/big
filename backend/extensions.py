from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

import os

import os

# Persistent storage for limiter (Use Redis if available, else memory as safe fallback)
REDIS = os.getenv("REDIS_URL")
# sqlite:// is not natively supported by 'limits' without extra setup. 
# Reverting to memory:// for maximum compatibility on Railway free tier.
LIMITER_DB_URI = REDIS if REDIS else "memory://"

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["2000 per day", "500 per hour"],
    storage_uri=LIMITER_DB_URI,
    strategy="fixed-window",
)
