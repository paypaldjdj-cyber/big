import sqlite3
import os

db_path = "c:/Users/Dell/Desktop/claude 1 - Copy/dental-clinic/backend/clinic.db"

def check_schema():
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    print("--- invoices schema ---")
    for row in cur.execute("PRAGMA table_info(invoices)"):
        print(row)
    
    print("\n--- patients schema ---")
    for row in cur.execute("PRAGMA table_info(patients)"):
        print(row)
    conn.close()

if __name__ == "__main__":
    check_schema()
