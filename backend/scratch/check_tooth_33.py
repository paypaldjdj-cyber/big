import sqlite3
import os

def check_tooth_33(db_path):
    if not os.path.exists(db_path):
        print(f"File {db_path} does not exist.")
        return
        
    print(f"Checking {db_path}...")
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check table names first
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [r[0] for r in cursor.fetchall()]
        
        table_name = "treatment_logs" if "treatment_logs" in tables else "treatments"
        if table_name not in tables:
            print(f"No treatment table found in {tables}")
            return
            
        # Search for any tooth number containing '33'
        cursor.execute(f"SELECT patient_id, tooth_number, procedure, date FROM {table_name} WHERE tooth_number LIKE '%33%'")
        rows = cursor.fetchall()
        
        if rows:
            print(f"Found {len(rows)} treatments related to 33:")
            for row in rows:
                print(row)
        else:
            print("No treatments found for 33.")
            
        conn.close()
    except Exception as e:
        print(f"Error checking {db_path}: {e}")

dbs = ["backend/clinic_u.db", "backend/clinic_guest.db", "backend/clinic_admin.db", "backend/clinic_doctor.db"]
for db in dbs:
    check_tooth_33(db)
