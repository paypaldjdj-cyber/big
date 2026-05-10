import sqlite3
import os

def dump_last_treatments(db_path):
    if not os.path.exists(db_path): 
        print(f"Path {db_path} not found.")
        return
    print(f"\n--- Last 50 treatments in {db_path} ---")
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [r[0] for r in cursor.fetchall()]
        table_name = "treatment_logs" if "treatment_logs" in tables else "treatments"
        
        if table_name in tables:
            cursor.execute(f"SELECT id, patient_id, tooth_number, procedure, date FROM {table_name} ORDER BY id DESC LIMIT 50")
            rows = cursor.fetchall()
            for row in rows:
                print(row)
        else:
            print(f"Table {table_name} not found.")
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

# Try both relative and absolute-ish paths
dbs = [
    "backend/clinic_u.db", 
    "backend/clinic_guest.db", 
    "backend/clinic_admin.db", 
    "backend/clinic_doctor.db",
    "clinic_u.db",
    "clinic_guest.db"
]

for db in dbs:
    dump_last_treatments(db)
