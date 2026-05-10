import sqlite3
import os

def cleanup():
    # Paths
    base_dir = os.path.dirname(os.path.abspath(__file__))
    db_folder = os.path.join(base_dir, "..", "databases")
    master_db = os.path.join(db_folder, "master.db")
    
    print(f"Starting cleanup in {db_folder}...")
    
    # 1. Clean Master DB
    if os.path.exists(master_db):
        try:
            conn = sqlite3.connect(master_db)
            cursor = conn.cursor()
            
            # Delete clinics except 'u'
            cursor.execute("DELETE FROM clinics WHERE username != 'u'")
            print(f"Deleted {cursor.rowcount} clinic records from master.db")
            
            # Delete users except 'u' and potential admins
            cursor.execute("DELETE FROM users WHERE username != 'u' AND role != 'admin'")
            print(f"Deleted {cursor.rowcount} user records from master.db")
            
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"Error updating master.db: {e}")
    
    # 2. Delete clinic database files
    if os.path.exists(db_folder):
        for filename in os.listdir(db_folder):
            if filename.endswith(".db") and filename not in ["master.db", "clinic_u.db"]:
                file_path = os.path.join(db_folder, filename)
                try:
                    os.remove(file_path)
                    print(f"Successfully deleted file: {filename}")
                except Exception as e:
                    print(f"Failed to delete {filename}: {e}")

    print("Cleanup finished!")

if __name__ == "__main__":
    cleanup()
