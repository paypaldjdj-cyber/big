import sqlite3
import os

db_path = r'c:\Users\Dell\Desktop\claude 1 - Copy - Copy - Copy\dental-clinic\backend\clinic_doctor.db'
if not os.path.exists(db_path):
    print(f"File {db_path} not found")
else:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(invoices)")
    cols = cursor.fetchall()
    print("Invoices columns:", [c[1] for c in cols])
    
    cursor.execute("SELECT COUNT(*) FROM patients")
    print("Patient count:", cursor.fetchone()[0])
    
    cursor.execute("SELECT SUM(total_amount), SUM(paid_amount) FROM invoices")
    print("Finance Sums:", cursor.fetchone())
    conn.close()
