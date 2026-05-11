import sqlite3
import os

db_path = os.path.join("backend", "databases", "master.db")
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    conn.execute("UPDATE doctors SET status = 'active'")
    conn.commit()
    conn.close()
    print("SUCCESS: All accounts activated in master.db")
else:
    print(f"ERROR: Database not found at {db_path}")
