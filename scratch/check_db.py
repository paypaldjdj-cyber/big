import sqlite3
import os

DB_PATH = r"c:\Users\Dell\Desktop\claude 1 - Copy - Copy\dental-clinic\databases\clinic_doctor.db"
MASTER_PATH = r"c:\Users\Dell\Desktop\claude 1 - Copy - Copy\dental-clinic\databases\master.db"

def check():
    print("--- Clinic Doctor DB ---")
    if os.path.exists(DB_PATH):
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        patients = cur.execute("SELECT COUNT(*) FROM patients").fetchone()[0]
        appointments = cur.execute("SELECT COUNT(*) FROM appointments").fetchone()[0]
        print(f"Patients: {patients}")
        print(f"Appointments: {appointments}")
        conn.close()
    else:
        print("Clinic DB not found")

    print("\n--- Master DB ---")
    if os.path.exists(MASTER_PATH):
        conn = sqlite3.connect(MASTER_PATH)
        cur = conn.cursor()
        cur.execute("UPDATE doctors SET status='active' WHERE username='doctor'")
        conn.commit()
        doctors = cur.execute("SELECT username, status, expiry_date FROM doctors").fetchall()
        print("Doctors:")
        for d in doctors:
            print(f"  - {d[0]}: Status={d[1]}, Expiry={d[2]}")
        conn.close()
    else:
        print("Master DB not found")

if __name__ == "__main__":
    check()
