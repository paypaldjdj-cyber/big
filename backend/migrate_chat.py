import sqlite3
import os
import glob

def migrate_all():
    # 1. Update Master DB
    master_path = "master.db"
    if os.path.exists(master_path):
        conn = sqlite3.connect(master_path)
        conn.execute("CREATE TABLE IF NOT EXISTS token_blacklist (token TEXT PRIMARY KEY, blacklisted_on TEXT DEFAULT CURRENT_TIMESTAMP)")
        conn.commit()
        conn.close()
        print("Master DB updated.")

    # 2. Update all Clinic DBs
    db_files = glob.glob("clinic_*.db")
    for db_file in db_files:
        try:
            conn = sqlite3.connect(db_file)
            # Create table if not exists
            conn.execute("""
                CREATE TABLE IF NOT EXISTS internal_messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    sender_role TEXT,
                    content TEXT,
                    image_url TEXT,
                    is_read INTEGER DEFAULT 0,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            """)
            # Add column if not exists
            try:
                conn.execute("ALTER TABLE internal_messages ADD COLUMN image_url TEXT")
            except:
                pass
            conn.commit()
            conn.close()
            print(f"Updated {db_file}")
        except Exception as e:
            print(f"Error updating {db_file}: {e}")

if __name__ == "__main__":
    migrate_all()
