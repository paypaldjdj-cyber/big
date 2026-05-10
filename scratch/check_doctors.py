import sqlite3
import os

db_path = r'c:\Users\Dell\Desktop\claude 1 - Copy - Copy\dental-clinic\databases\master.db'
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    doctors = conn.execute("SELECT * FROM doctors").fetchall()
    for d in doctors:
        print(dict(d))
    conn.close()
else:
    print("DB not found")
