import sqlite3
import os

# Find the database
db_path = "../../backend/instance/clinic_guest.db" # Adjusted path
if not os.path.exists(db_path):
    # Try another common location
    db_path = "../../backend/clinic_guest.db"

def check_db():
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        
        print("--- Invoices Table Sample ---")
        rows = cur.execute("SELECT * FROM invoices ORDER BY id DESC LIMIT 5").fetchall()
        for r in rows:
            print(dict(r))
            
        print("\n--- Invoices for 2026-05-07 ---")
        rows = cur.execute("SELECT * FROM invoices WHERE date = '2026-05-07'").fetchall()
        print(f"Found {len(rows)} rows for 2026-05-07")
        for r in rows:
            print(dict(r))
            
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_db()
