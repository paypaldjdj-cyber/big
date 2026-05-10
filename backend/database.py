import sqlite3
import os
import sys
import jwt
from flask import request, g, jsonify, current_app
from functools import wraps
from werkzeug.security import generate_password_hash
from dotenv import load_dotenv

load_dotenv()

# Database path logic for Desktop App
def get_db_root():
    # Priority 1: Environment Variable (Perfect for Railway Volumes)
    env_path = os.environ.get('DATABASE_FOLDER')
    if env_path:
        if not os.path.exists(env_path): os.makedirs(env_path)
        return env_path

    # Priority 2: If running as a bundled EXE
    if getattr(sys, 'frozen', False):
        app_data = os.environ.get('APPDATA')
        path = os.path.join(app_data, "SmileCareClinic", "databases")
    else:
        # Priority 3: Development mode / Default
        BASE_DIR = os.path.dirname(os.path.abspath(__file__))
        path = os.path.join(BASE_DIR, "databases")

    
    if not os.path.exists(path):
        os.makedirs(path)
    return path

DB_FOLDER = get_db_root()
MASTER_DB_PATH = os.path.join(DB_FOLDER, "master.db")


def get_master_db():
    conn = sqlite3.connect(MASTER_DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    return conn

def get_clinic_db_path(username):
    """Returns the consistent path for a clinic's database."""
    # Priority 1: Check for the legacy 'clinic.db' in DB_FOLDER or backend folder (for 'doctor' user)
    if username == "doctor":
        legacy_root = os.path.join(DB_FOLDER, "clinic.db")
        legacy_backend = os.path.join(os.path.dirname(__file__), "clinic.db")
        
        if os.path.exists(legacy_backend):
            # Move to DB_FOLDER for consistency
            try:
                import shutil
                if not os.path.exists(legacy_root):
                    shutil.move(legacy_backend, legacy_root)
                else:
                    # If both exist, we might have a conflict, but we'll stick to legacy_root
                    pass
            except: pass
            
        if os.path.exists(legacy_root):
            return legacy_root

    # Default: Standard naming convention
    return os.path.join(DB_FOLDER, f"clinic_{username}.db")

def get_db(username=None):
    if not username:
        token = request.headers.get("Authorization") or request.args.get("token")
        if token:
            try:
                if isinstance(token, str) and "Bearer " in token: 
                    token = token.split(" ")[1]
                
                secret = os.getenv("SECRET_KEY", "debug-secret-key-123")
                if not os.getenv("SECRET_KEY"):
                    current_app.logger.warning("DB Layer: Using debug SECRET_KEY")
                data = jwt.decode(token, secret, algorithms=["HS256"])
                master_conn = get_master_db()
                is_blacklisted = master_conn.execute("SELECT 1 FROM token_blacklist WHERE token = ?", (token,)).fetchone()
                master_conn.close()
                if is_blacklisted:
                    raise Exception("Blacklisted token")
                    
                username = data.get("username")
                g.user = data
            except Exception as e:
                print(f"--- TOKEN_PARSE_ERROR: {str(e)} ---")
                username = "guest"
        else:
            username = "guest"

    if not username or username == "None":
        raise Exception("Unauthorized: Clinic database access requires a valid username.")

    db_path = get_clinic_db_path(username)
    print(f"--- Secure Access: {os.path.basename(db_path)} ---")
    
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    init_clinic_schema(conn)
    return conn

def init_db():
    conn = get_master_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS doctors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            clinic_name TEXT,
            doctor_name TEXT,
            expiry_date TEXT,
            status TEXT DEFAULT 'active',
            secretary_enabled INTEGER DEFAULT 0,
            secretary_password TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_doctors_username ON doctors(username)")
    
    # Master Settings Table
    conn.execute("""
        CREATE TABLE IF NOT EXISTS master_settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    """)
    conn.execute("INSERT OR IGNORE INTO master_settings (key, value) VALUES ('support_phone', '07XXXXXXXXX')")
    
    # Token Blacklist Table
    conn.execute("""
        CREATE TABLE IF NOT EXISTS token_blacklist (
            token TEXT PRIMARY KEY,
            blacklisted_on TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Migrations for master.db
    columns = [
        ("expiry_date", "TEXT"), 
        ("status", "TEXT DEFAULT 'active'"), 
        ("secretary_enabled", "INTEGER DEFAULT 0"), 
        ("secretary_password", "TEXT"),
        ("doctor_name", "TEXT"),
        ("clinic_name", "TEXT")
    ]
    for col, ctype in columns:
        try: conn.execute(f"ALTER TABLE doctors ADD COLUMN {col} {ctype}")
        except: pass
        
    # Create an initial superadmin if needed or default doctor
    hashed_doc = generate_password_hash('doctor123')
    conn.execute("INSERT OR IGNORE INTO doctors (username, password, clinic_name, status) VALUES ('doctor', ?, 'عيادة الابتسامة', 'active')", (hashed_doc,))
    conn.commit()
    conn.close()

    # Also init default db just in case
    conn = get_db("doctor")
    init_clinic_schema(conn)
    conn.close()

def init_clinic_schema(conn):
    # Standard Clinic Tables
    conn.execute("""
        CREATE TABLE IF NOT EXISTS patients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            first_name TEXT,
            last_name TEXT,
            phone TEXT,
            birth_date TEXT,
            age INTEGER,
            gender TEXT,
            occupation TEXT,
            address TEXT,
            systemic_conditions TEXT,
            notes TEXT,
            case_category TEXT,
            status TEXT DEFAULT 'جديد',
            case_notes TEXT,
            case_images TEXT,
            is_ongoing INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_DATE
        )
    """)
    
    # Migrations for clinic DBs
    clinic_columns = [
        ("status", "TEXT DEFAULT 'جديد'"),
        ("case_notes", "TEXT"),
        ("case_images", "TEXT"),
        ("payment_system", "TEXT DEFAULT 'total'"),
        ("total_agreed_price", "REAL DEFAULT 0"),
        ("debt", "REAL DEFAULT 0"),
        ("total_paid", "REAL DEFAULT 0")
    ]
    for col, ctype in clinic_columns:
        try: conn.execute(f"ALTER TABLE patients ADD COLUMN {col} {ctype}")
        except: pass

    # Data migration for existing patients
    try:
        conn.execute("UPDATE patients SET total_agreed_price = (SELECT COALESCE(MAX(agreed_price), 0) FROM invoices WHERE invoices.patient_id = patients.id) WHERE total_agreed_price = 0")
    except: pass
    
    conn.execute("""
        CREATE TABLE IF NOT EXISTS invoices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id INTEGER,
            total_amount REAL DEFAULT 0,
            paid_amount REAL DEFAULT 0,
            payment_method TEXT DEFAULT 'Cash',
            date TEXT,
            status TEXT,
            notes TEXT
        )
    """)
    
    # Migrations for invoices (Advanced Data Recovery)
    inv_migrations = [
        ("total_amount", "REAL DEFAULT 0"),
        ("paid_amount", "REAL DEFAULT 0"),
        ("payment_method", "TEXT DEFAULT 'Cash'")
    ]
    for col, ctype in inv_migrations:
        try: conn.execute(f"ALTER TABLE invoices ADD COLUMN {col} {ctype}")
        except: pass
        
    # SYNC DATA from old columns if they exist and new columns are empty
    try:
        conn.execute("UPDATE invoices SET total_amount = COALESCE(agreed_price, amount) WHERE total_amount = 0")
        conn.execute("UPDATE invoices SET paid_amount = COALESCE(paid, paid_amount) WHERE paid_amount = 0")
    except:
        pass

    schema = [
        "CREATE TABLE IF NOT EXISTS treatment_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, patient_id INTEGER, tooth_number TEXT, procedure TEXT, notes TEXT, cost REAL DEFAULT 0, date TEXT DEFAULT CURRENT_DATE, FOREIGN KEY(patient_id) REFERENCES patients(id))",
        "CREATE TABLE IF NOT EXISTS appointments (id INTEGER PRIMARY KEY AUTOINCREMENT, patient_id INTEGER, date TEXT, time TEXT, type TEXT, duration_min INTEGER, status TEXT DEFAULT 'قادم', notes TEXT, teeth_snapshot TEXT)",
        "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT, role TEXT)",
        "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)",
        "CREATE TABLE IF NOT EXISTS expenses (id INTEGER PRIMARY KEY AUTOINCREMENT, category TEXT, amount REAL, payment_method TEXT DEFAULT 'Cash', date TEXT, notes TEXT)",
        "CREATE TABLE IF NOT EXISTS teeth_map (patient_id INTEGER PRIMARY KEY, map_data TEXT)",
        "CREATE TABLE IF NOT EXISTS prescriptions (id INTEGER PRIMARY KEY AUTOINCREMENT, patient_id INTEGER, meds TEXT, notes TEXT, date TEXT, image_url TEXT, rx_number TEXT, diagnosis TEXT, drugs_json TEXT)",
        "CREATE TABLE IF NOT EXISTS drugs (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, category TEXT, forms TEXT, doses_adult TEXT, doses_child TEXT, doses_elderly TEXT, timing TEXT, duration TEXT, note TEXT, warn_pregnant TEXT, warn_breastfeed TEXT, warn_renal TEXT, warn_hepatic TEXT, warn_allergy TEXT, warn_diabetes TEXT, warn_blood_pressure TEXT, max_daily_dose REAL DEFAULT 0, is_custom INTEGER DEFAULT 0, stock_quantity REAL DEFAULT 0, min_quantity REAL DEFAULT 5, unit TEXT DEFAULT 'Piece')",
        "CREATE TABLE IF NOT EXISTS inventory_items (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, category TEXT, stock_quantity REAL DEFAULT 0, min_quantity REAL DEFAULT 5, unit TEXT DEFAULT 'Piece', purchase_price REAL DEFAULT 0, last_updated TEXT DEFAULT CURRENT_TIMESTAMP)",
        "CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, user_id INTEGER, username TEXT, role TEXT, action TEXT, target_id INTEGER, target_name TEXT, description TEXT, old_data TEXT, new_data TEXT)",
        "CREATE TABLE IF NOT EXISTS internal_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, sender_role TEXT, content TEXT, image_url TEXT, is_read INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP)"
    ]
    for s in schema: conn.execute(s)

    # MIGRATION: Ensure audit_logs has the new columns if it already exists
    try:
        conn.execute("ALTER TABLE audit_logs ADD COLUMN old_data TEXT")
    except: pass
    try:
        conn.execute("ALTER TABLE audit_logs ADD COLUMN new_data TEXT")
    except: pass

    # ==============================================================
    # ⚡ SMART FINANCIAL TRIGGERS (UNIVERSAL DEBT & PAID SYNC) ⚡
    # These triggers ensure the patient's debt AND total_paid are ALWAYS 100% accurate.
    # ==============================================================
    triggers = [
        """CREATE TRIGGER IF NOT EXISTS trg_invoice_ins AFTER INSERT ON invoices BEGIN 
            UPDATE patients SET 
                total_paid = COALESCE((SELECT SUM(paid_amount) FROM invoices WHERE patient_id = NEW.patient_id), 0),
                debt = (CASE WHEN payment_system = 'sessions' THEN COALESCE((SELECT SUM(cost) FROM treatment_logs WHERE patient_id = NEW.patient_id), 0) - COALESCE((SELECT SUM(paid_amount) FROM invoices WHERE patient_id = NEW.patient_id), 0) ELSE COALESCE(total_agreed_price, 0) - COALESCE((SELECT SUM(paid_amount) FROM invoices WHERE patient_id = NEW.patient_id), 0) END) 
            WHERE id = NEW.patient_id; END;""",
        """CREATE TRIGGER IF NOT EXISTS trg_invoice_upd AFTER UPDATE ON invoices BEGIN 
            UPDATE patients SET 
                total_paid = COALESCE((SELECT SUM(paid_amount) FROM invoices WHERE patient_id = NEW.patient_id), 0),
                debt = (CASE WHEN payment_system = 'sessions' THEN COALESCE((SELECT SUM(cost) FROM treatment_logs WHERE patient_id = NEW.patient_id), 0) - COALESCE((SELECT SUM(paid_amount) FROM invoices WHERE patient_id = NEW.patient_id), 0) ELSE COALESCE(total_agreed_price, 0) - COALESCE((SELECT SUM(paid_amount) FROM invoices WHERE patient_id = NEW.patient_id), 0) END) 
            WHERE id = NEW.patient_id; END;""",
        """CREATE TRIGGER IF NOT EXISTS trg_invoice_del AFTER DELETE ON invoices BEGIN 
            UPDATE patients SET 
                total_paid = COALESCE((SELECT SUM(paid_amount) FROM invoices WHERE patient_id = OLD.patient_id), 0),
                debt = (CASE WHEN payment_system = 'sessions' THEN COALESCE((SELECT SUM(cost) FROM treatment_logs WHERE patient_id = OLD.patient_id), 0) - COALESCE((SELECT SUM(paid_amount) FROM invoices WHERE patient_id = OLD.patient_id), 0) ELSE COALESCE(total_agreed_price, 0) - COALESCE((SELECT SUM(paid_amount) FROM invoices WHERE patient_id = OLD.patient_id), 0) END) 
            WHERE id = OLD.patient_id; END;""",
        """CREATE TRIGGER IF NOT EXISTS trg_treatment_ins AFTER INSERT ON treatment_logs BEGIN 
            UPDATE patients SET 
                debt = (CASE WHEN payment_system = 'sessions' THEN COALESCE((SELECT SUM(cost) FROM treatment_logs WHERE patient_id = NEW.patient_id), 0) - COALESCE(total_paid, 0) ELSE COALESCE(total_agreed_price, 0) - COALESCE(total_paid, 0) END) 
            WHERE id = NEW.patient_id; END;""",
        """CREATE TRIGGER IF NOT EXISTS trg_treatment_upd AFTER UPDATE ON treatment_logs BEGIN 
            UPDATE patients SET 
                debt = (CASE WHEN payment_system = 'sessions' THEN COALESCE((SELECT SUM(cost) FROM treatment_logs WHERE patient_id = NEW.patient_id), 0) - COALESCE(total_paid, 0) ELSE COALESCE(total_agreed_price, 0) - COALESCE(total_paid, 0) END) 
            WHERE id = NEW.patient_id; END;""",
        """CREATE TRIGGER IF NOT EXISTS trg_treatment_del AFTER DELETE ON treatment_logs BEGIN 
            UPDATE patients SET 
                debt = (CASE WHEN payment_system = 'sessions' THEN COALESCE((SELECT SUM(cost) FROM treatment_logs WHERE patient_id = OLD.patient_id), 0) - COALESCE(total_paid, 0) ELSE COALESCE(total_agreed_price, 0) - COALESCE(total_paid, 0) END) 
            WHERE id = OLD.patient_id; END;""",
        """CREATE TRIGGER IF NOT EXISTS trg_patient_upd AFTER UPDATE OF total_agreed_price, payment_system ON patients BEGIN 
            UPDATE patients SET 
                debt = (CASE WHEN NEW.payment_system = 'sessions' THEN COALESCE((SELECT SUM(cost) FROM treatment_logs WHERE patient_id = NEW.id), 0) - COALESCE(total_paid, 0) ELSE COALESCE(NEW.total_agreed_price, 0) - COALESCE(total_paid, 0) END) 
            WHERE id = NEW.id; END;"""
    ]
    
    # We must drop the old triggers first to replace them
    old_trgs = ['trg_invoice_ins', 'trg_invoice_upd', 'trg_invoice_del', 'trg_treatment_ins', 'trg_treatment_upd', 'trg_treatment_del', 'trg_patient_upd']
    for t in old_trgs:
        try: conn.execute(f"DROP TRIGGER IF EXISTS {t}")
        except: pass

    for trg in triggers:
        try: conn.execute(trg)
        except Exception as e: print("Trigger Error:", e)

    # Initial Migration: Sync all existing patients' debts AND paid amounts accurately!
    try:
        conn.execute("""
            UPDATE patients SET 
                total_paid = COALESCE((SELECT SUM(paid_amount) FROM invoices WHERE patient_id = patients.id), 0),
                debt = (
                    CASE WHEN payment_system = 'sessions' THEN 
                        COALESCE((SELECT SUM(cost) FROM treatment_logs WHERE patient_id = patients.id), 0) - COALESCE((SELECT SUM(paid_amount) FROM invoices WHERE patient_id = patients.id), 0)
                    ELSE 
                        COALESCE(total_agreed_price, 0) - COALESCE((SELECT SUM(paid_amount) FROM invoices WHERE patient_id = patients.id), 0)
                    END
                )
        """)
    except Exception as e: print("Migration Error:", e)
    
    conn.commit()
    
    # Indexes for performance
    conn.execute("CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(first_name, last_name)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_invoices_patient ON invoices(patient_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date)")

    # Migration for prescriptions
    try: conn.execute("ALTER TABLE prescriptions ADD COLUMN image_url TEXT")
    except: pass
    try: conn.execute("ALTER TABLE prescriptions ADD COLUMN rx_number TEXT")
    except: pass
    try: conn.execute("ALTER TABLE prescriptions ADD COLUMN diagnosis TEXT")
    except: pass
    try: conn.execute("ALTER TABLE prescriptions ADD COLUMN drugs_json TEXT")
    except: pass
    
    # Migrations for drugs (new warnings and inventory)
    try: conn.execute("ALTER TABLE drugs ADD COLUMN warn_allergy TEXT")
    except: pass
    try: conn.execute("ALTER TABLE drugs ADD COLUMN warn_diabetes TEXT")
    except: pass
    try: conn.execute("ALTER TABLE drugs ADD COLUMN warn_blood_pressure TEXT")
    except: pass
    try: conn.execute("ALTER TABLE drugs ADD COLUMN stock_quantity REAL DEFAULT 0")
    except: pass
    try: conn.execute("ALTER TABLE drugs ADD COLUMN min_quantity REAL DEFAULT 5")
    except: pass
    try: conn.execute("ALTER TABLE drugs ADD COLUMN max_daily_dose REAL DEFAULT 0")
    except: pass
    # Add is_favorite to drugs
    try:
        conn.execute("ALTER TABLE drugs ADD COLUMN is_favorite INTEGER DEFAULT 0")
        conn.commit()
    except: pass
    
    # Seed default drugs if empty
    import json
    # TOTAL WIPE and PURE ENGLISH SEED
    arabic_check = conn.execute("SELECT COUNT(*) FROM drugs WHERE timing LIKE '%يوم%' OR category LIKE '%حيوي%'").fetchone()[0]
    # If any Arabic remains, or if we just want to ensure clean state
    if arabic_check > 0:
        conn.execute("DELETE FROM drugs")
        
    drugs_count = conn.execute("SELECT COUNT(*) FROM drugs").fetchone()[0]
    if drugs_count == 0:
        default_drugs = [
            {
                "name": "Amoxicillin (Augmentin)",
                "category": "Antibiotic (Penicillin)",
                "forms": '["Capsule", "Syrup", "Tablet"]',
                "doses_adult": '["500mg", "875mg", "1000mg"]',
                "doses_child": '["25mg/kg", "45mg/kg"]',
                "doses_elderly": '["500mg"]',
                "timing": '["Every 8 hours", "Every 12 hours", "3 times daily"]',
                "duration": '["5 days", "7 days", "10 days"]',
                "note": "Take with or after food. Complete the full course.",
                "warn_pregnant": "Category B - Safe",
                "warn_breastfeed": "Safe",
                "warn_renal": "Reduce dose if GFR < 30",
                "warn_hepatic": "Use with caution",
                "warn_allergy": "Strictly contraindicated if Penicillin allergic",
                "warn_diabetes": "Syrup may contain sugar",
                "warn_blood_pressure": "Safe"
            },
            {
                "name": "Ibuprofen (Brufen/Advil)",
                "category": "NSAID (Analgesic)",
                "forms": '["Tablet", "Syrup", "Gel", "Suppository"]',
                "doses_adult": '["400mg", "600mg"]',
                "doses_child": '["10mg/kg"]',
                "doses_elderly": '["200mg"]',
                "timing": '["3 times daily", "Every 8 hours", "As needed"]',
                "duration": '["3 days", "5 days"]',
                "note": "Take with food to protect stomach.",
                "warn_pregnant": "Contraindicated in 3rd trimester",
                "warn_breastfeed": "Preferably avoided",
                "warn_renal": "Avoid in severe renal impairment",
                "warn_hepatic": "Safe in usual doses",
                "warn_allergy": "Contraindicated in Asthma/Aspirin allergy",
                "warn_diabetes": "Safe",
                "warn_blood_pressure": "May increase BP in long-term use"
            },
            {
                "name": "Paracetamol (Panadol)",
                "category": "Analgesic / Antipyretic",
                "forms": '["Tablet", "Syrup", "Suppository", "IV"]',
                "doses_adult": '["500mg", "1000mg"]',
                "doses_child": '["15mg/kg"]',
                "doses_elderly": '["500mg"]',
                "timing": '["Every 6 hours", "Every 8 hours", "As needed"]',
                "duration": '["3 days", "As needed"]',
                "note": "Maximum 4 grams per 24 hours.",
                "warn_pregnant": "Category B - Safe",
                "warn_breastfeed": "Safe",
                "warn_renal": "Safe at normal doses",
                "warn_hepatic": "Contraindicated in severe liver failure",
                "warn_allergy": "Safe",
                "warn_diabetes": "Safe",
                "warn_blood_pressure": "Safe"
            },
            {
                "name": "Metronidazole (Flagyl)",
                "category": "Antiprotozoal / Antibiotic",
                "forms": '["Tablet", "Suspension", "Infusion"]',
                "doses_adult": ["500mg"],
                "doses_child": ["7.5mg/kg"],
                "doses_elderly": ["400mg"],
                "timing": '["3 times daily", "Every 8 hours"]',
                "duration": '["5 days", "7 days"]',
                "note": "Avoid alcohol during and 48h after treatment.",
                "warn_pregnant": "Avoid in 1st trimester",
                "warn_breastfeed": "Avoid during treatment",
                "warn_renal": "Reduce dose in GFR < 10",
                "warn_hepatic": "Reduce dose in severe liver disease",
                "warn_allergy": "Safe",
                "warn_diabetes": "Safe",
                "warn_blood_pressure": "Safe"
            }
        ]
        for d in default_drugs:
            # Ensure all complex fields are JSON strings
            def clean_val(v):
                if isinstance(v, (list, dict)): return json.dumps(v)
                return v

            conn.execute("""
                INSERT INTO drugs (name, category, forms, doses_adult, doses_child, doses_elderly, timing, duration, note, warn_pregnant, warn_breastfeed, warn_renal, warn_hepatic, warn_allergy, warn_diabetes, warn_blood_pressure, is_custom)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
            """, (
                d["name"], d["category"], clean_val(d.get("forms", "[]")), clean_val(d.get("doses_adult", "[]")), 
                clean_val(d.get("doses_child", "[]")), clean_val(d.get("doses_elderly", "[]")), clean_val(d.get("timing", "[]")), 
                clean_val(d.get("duration", "[]")), d["note"], d["warn_pregnant"], d.get("warn_breastfeed", ""), 
                d["warn_renal"], d["warn_hepatic"], d.get("warn_allergy", ""), 
                d.get("warn_diabetes", ""), d.get("warn_blood_pressure", "")
            ))
    
    # Migrations for appointments
    apt_cols = [("duration_min", "INTEGER DEFAULT 30"), ("type", "TEXT"), ("notes", "TEXT"), ("status", "TEXT DEFAULT 'قادم'")]
    for col, ctype in apt_cols:
        try: conn.execute(f"ALTER TABLE appointments ADD COLUMN {col} {ctype}")
        except: pass
    
    # Smart Data Sync for Appointments (old columns to new)
    try:
        conn.execute("UPDATE appointments SET type = treatment WHERE type IS NULL AND treatment IS NOT NULL")
        conn.execute("UPDATE appointments SET duration_min = duration WHERE duration_min IS NULL AND duration IS NOT NULL")
        # Migrate statuses
        conn.execute("UPDATE appointments SET status = 'booked' WHERE status = 'قادم'")
        conn.execute("UPDATE appointments SET status = 'finished' WHERE status = 'مكتمل'")
        conn.execute("UPDATE appointments SET status = 'absent' WHERE status = 'ملغي'")
        conn.execute("UPDATE appointments SET status = 'booked' WHERE status IS NULL OR status = ''")
    except: pass
    
    try: 
        conn.execute("ALTER TABLE appointments ADD COLUMN teeth_snapshot TEXT")
        print("--- DB MIGRATION: Added teeth_snapshot to appointments ---")
    except: 
        pass
    
    # Default Users
    hashed_admin = generate_password_hash('admin123')
    hashed_staff = generate_password_hash('staff123')
    conn.execute("INSERT OR IGNORE INTO users (username, password, role) VALUES ('admin', ?, 'doctor')", (hashed_admin,))
    conn.execute("INSERT OR IGNORE INTO users (username, password, role) VALUES ('staff', ?, 'secretary')", (hashed_staff,))
    conn.commit()

def db_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        g.db = get_db()
        
        # Security Check: Ensure the token was actually valid and parsed
        if getattr(g, 'user', None) is None:
            auth_header = request.headers.get("Authorization", "MISSING")
            print(f"--- DB_REQUIRED REJECTED: Auth header = '{auth_header[:30] if auth_header else 'NONE'}...' ---")
            g.db.close()
            return jsonify({"error": "Unauthorized Access"}), 401
            
        try:
            return f(*args, **kwargs)
        finally:
            g.db.close()
    return decorated_function

def log_action(action, target_id=None, target_name=None, description=None, old_data=None, new_data=None):
    """Logs an action to the current clinic's database with diff support."""
    try:
        import json
        if not hasattr(g, 'db') or not hasattr(g, 'user'):
            return
        
        user_id = g.user.get('id')
        username = g.user.get('username')
        role = g.user.get('role')
        
        # Robust cleaner to prevent binding errors
        def force_primitive(v):
            if v is None: return None
            if isinstance(v, (int, float, str)): return v
            try:
                import json
                return json.dumps(v)
            except:
                return str(v)

        vals = (
            force_primitive(user_id),
            force_primitive(username),
            force_primitive(role),
            force_primitive(action),
            force_primitive(target_id),
            force_primitive(target_name),
            force_primitive(description),
            json.dumps(old_data) if old_data else None,
            json.dumps(new_data) if new_data else None
        )
        
        # DEBUG PRINT
        print(f"--- LOGGING_VALUES: {vals} ---")
        
        g.db.execute("""
            INSERT INTO audit_logs (user_id, username, role, action, target_id, target_name, description, old_data, new_data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, vals)
        g.db.commit()
    except Exception as e:
        print(f"--- LOGGING_ERROR: {str(e)} ---")
        # Ensure we don't crash the main process if logging fails
        pass

def cleanup_old_tokens():
    """Delete blacklisted tokens older than 24 hours to keep the database light."""
    try:
        conn = get_master_db()
        # CURRENT_TIMESTAMP is UTC
        res = conn.execute("DELETE FROM token_blacklist WHERE blacklisted_on < datetime('now', '-1 day')")
        conn.commit()
        count = res.rowcount
        conn.close()
        print(f"--- CLEANUP: Removed {count} expired tokens from blacklist ---")
        return count
    except Exception as e:
        print(f"--- CLEANUP_ERROR: {str(e)} ---")
        return 0
