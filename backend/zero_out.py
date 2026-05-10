import sqlite3
import os

# Identify the database path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "databases", "clinic_doctor.db")

if not os.path.exists(DB_PATH):
    # Try legacy path
    DB_PATH = os.path.join(BASE_DIR, "clinic.db")

if os.path.exists(DB_PATH):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    tables = ["patients", "appointments", "invoices", "expenses", "teeth_map", "prescriptions", "treatment_logs"]
    
    print(f"Zeroing out database: {DB_PATH}")
    for table in tables:
        try:
            cursor.execute(f"DELETE FROM {table}")
            print(f"Cleared table: {table}")
        except Exception as e:
            print(f"Table {table} skipped or not found: {e}")
            
    # Add an audit log entry for the reset
    try:
        cursor.execute("""
            INSERT INTO audit_logs (username, role, action, description) 
            VALUES ('doctor', 'doctor', 'CLINIC_RESET', 'تم تصفير كافة بيانات العيادة يدوياً بطلب من الطبيب')
        """)
    except: pass
    
    conn.commit()
    conn.close()
    print("Clinic data has been successfully zeroed out.")
else:
    print(f"Error: Database file not found at {DB_PATH}")
