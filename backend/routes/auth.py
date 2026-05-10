from flask import Blueprint, request, jsonify, current_app, send_file
from database import get_db, get_master_db, init_clinic_schema, log_action, DB_FOLDER
import datetime
import jwt
from functools import wraps
from werkzeug.security import generate_password_hash, check_password_hash
import os
from dotenv import load_dotenv

load_dotenv()

auth_bp = Blueprint("auth", __name__)

# Key for consistency across modules
SECRET_KEY = os.getenv("SECRET_KEY", "debug-secret-key-123")
if not os.getenv("SECRET_KEY"):
    print("WARNING: SECRET_KEY is not set in .env! Using debug key.")

# --- Authentication Middleware ---
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get("Authorization")
        if not token:
            return jsonify({"error": "Token is missing"}), 401
        try:
            if " " in token:
                token = token.split(" ")[1]
            
            master_conn = get_master_db()
            is_blacklisted = master_conn.execute("SELECT 1 FROM token_blacklist WHERE token = ?", (token,)).fetchone()
            master_conn.close()
            if is_blacklisted:
                return jsonify({"error": "Token is blacklisted"}), 401

            data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            request.user = data
        except Exception as e:
            return jsonify({"error": "Token is invalid or expired"}), 401
        return f(*args, **kwargs)
    return decorated

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get("Authorization")
        if not token: return jsonify({"error": "Unauthorized"}), 401
        try:
            if " " in token: token = token.split(" ")[1]
            
            master_conn = get_master_db()
            is_blacklisted = master_conn.execute("SELECT 1 FROM token_blacklist WHERE token = ?", (token,)).fetchone()
            master_conn.close()
            if is_blacklisted:
                return jsonify({"error": "Token is blacklisted"}), 401
                
            data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            if data.get("role") != "admin":
                return jsonify({"error": "Admin access required"}), 403
            request.user = data
        except Exception as e:
            current_app.logger.error(f"Auth error: {str(e)}")
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated

from extensions import limiter

@auth_bp.route("/login", methods=["POST"])
@limiter.limit("10 per minute")
def login():
    data = request.json or {}
    u = data.get("username", "").strip().lower()
    p = data.get("password")
    
    current_app.logger.info(f"--- LOGIN ATTEMPT: {u} ---")

    if not u or not p:
        return jsonify({"error": "Username and password required"}), 400

    # 1. Admin Login (Enforce secure .env password)
    admin_pass = os.getenv("ADMIN_PASSWORD", "admin123")
    if not os.getenv("ADMIN_PASSWORD"):
        current_app.logger.warning("WARNING: ADMIN_PASSWORD not set. Using 'admin123'")

    if u == "admin" and p == admin_pass:
        current_app.logger.info("ADMIN_LOGIN: Success")
        token = jwt.encode({
            "username": "admin",
            "role": "admin",
            "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=24)
        }, SECRET_KEY, algorithm="HS256")
        return jsonify({"token": token, "role": "admin", "username": "admin"})

    # 2. Doctor/Clinic Login from Master DB
    master_conn = get_master_db()
    doctor_row = master_conn.execute("SELECT * FROM doctors WHERE username = ?", (u,)).fetchone()
    
    if not doctor_row:
        current_app.logger.warning(f"LOGIN_FAILED: User '{u}' not found")
        master_conn.close()
        return jsonify({"error": "Invalid credentials"}), 401

    doctor = dict(doctor_row)

    # Debug Password Matching
    is_valid = False
    role = None
    stored_p = doctor.get('password')
    sec_p = doctor.get('secretary_password')
    sec_enabled = doctor.get('secretary_enabled', 0)
    
    current_app.logger.debug(f"Login attempt detail: u={u}")
    
    if stored_p and (stored_p == p or check_password_hash(stored_p, p)):
        is_valid = True
        role = "doctor"
        current_app.logger.debug(f"Doctor match for {u}")
    elif sec_enabled and sec_p and (sec_p == p or check_password_hash(sec_p, p)):
        is_valid = True
        role = "secretary"
        current_app.logger.debug(f"Secretary match for {u}")
    else:
        current_app.logger.warning(f"Login credentials mismatch for {u}")
    
    if not is_valid:
        master_conn.close()
        return jsonify({"error": "Invalid credentials"}), 401

    # Check Status
    status = doctor.get('status', 'active')
    if status == 'inactive':
        current_app.logger.warning(f"LOGIN_BLOCKED: Account '{u}' is inactive")
        master_conn.close()
        return jsonify({"error": "Account deactivated"}), 403
        
    # Check Expiry
    expiry = doctor.get('expiry_date')
    if expiry:
        try:
            exp_date = datetime.datetime.fromisoformat(expiry).date()
            if exp_date < datetime.date.today():
                current_app.logger.warning(f"LOGIN_BLOCKED: Subscription for '{u}' expired")
                master_conn.close()
                return jsonify({"error": "Subscription expired"}), 403
        except:
            pass

    # 3. Create Token
    token = jwt.encode({
        "username": u,
        "role": role,
        "clinic_id": doctor["id"],
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=24)
    }, SECRET_KEY, algorithm="HS256")

    # Support Phone
    support_phone = master_conn.execute("SELECT value FROM master_settings WHERE key='support_phone'").fetchone()
    support_val = support_phone["value"] if support_phone else "07XXXXXXXXX"

    res = {
        "token": token,
        "username": u,
        "role": role,
        "clinic_id": doctor["id"],
        "clinic_name": doctor.get("clinic_name", ""),
        "doctor_name": doctor.get("doctor_name", ""),
        "expiry_date": expiry,
        "status": status,
        "support_phone": support_val
    }
    master_conn.close()
    
    # Audit Log for Login
    from flask import g
    g.user = {"id": doctor["id"], "username": u, "role": role}
    g.db = get_db(u)
    log_action("LOGIN", description=f"تم تسجيل الدخول بنجاح برتبة {role}")
    g.db.close()

    current_app.logger.info(f"LOGIN_SUCCESS: {u} is now logged in")
    return jsonify(res)

@auth_bp.route("/logout", methods=["POST"])
@token_required
def logout():
    token = request.headers.get("Authorization")
    if token and " " in token: 
        token = token.split(" ")[1]
    
    # Audit Log for Logout
    from database import get_db
    from flask import g
    g.db = get_db(request.user.get("username"))
    log_action("LOGOUT", description="تم تسجيل الخروج من النظام")
    g.db.close()

    master_conn = get_master_db()
    master_conn.execute("INSERT OR IGNORE INTO token_blacklist (token) VALUES (?)", (token,))
    master_conn.commit()
    master_conn.close()
    return jsonify({"ok": True})

@auth_bp.route("/me", methods=["GET"])
@token_required
def get_me():
    return jsonify(request.user)

@auth_bp.route("/announcement", methods=["GET"])
def get_public_announcement():
    master_conn = get_master_db()
    row = master_conn.execute("SELECT value FROM master_settings WHERE key='broadcast_message'").fetchone()
    master_conn.close()
    return jsonify({"message": row["value"] if row else ""})

@auth_bp.route("/admin/settings", methods=["GET"])
@admin_required
def get_admin_settings():
    master_conn = get_master_db()
    rows = master_conn.execute("SELECT * FROM master_settings").fetchall()
    master_conn.close()
    return jsonify({r['key']: r['value'] for r in rows})

@auth_bp.route("/admin/stats", methods=["GET"])
@admin_required
def get_admin_stats():
    master_conn = get_master_db()
    try:
        total = master_conn.execute("SELECT COUNT(*) as c FROM doctors").fetchone()['c']
        active = master_conn.execute("SELECT COUNT(*) as c FROM doctors WHERE status='active'").fetchone()['c']
        inactive = master_conn.execute("SELECT COUNT(*) as c FROM doctors WHERE status='inactive'").fetchone()['c']
        
        # Expired check (only those with valid dates)
        now = datetime.date.today().isoformat()
        expired = master_conn.execute("SELECT COUNT(*) as c FROM doctors WHERE expiry_date IS NOT NULL AND expiry_date != '' AND expiry_date < ? AND status='active'", (now,)).fetchone()['c']
        
        # New today
        today = master_conn.execute("SELECT COUNT(*) as c FROM doctors WHERE created_at = ?", (now,)).fetchone()['c']
        
        print(f"DEBUG_STATS: Total={total}, Active={active}, Expired={expired}")
        
        return jsonify({
            "total_clinics": total,
            "active_clinics": active,
            "inactive_clinics": inactive,
            "expired_clinics": expired,
            "new_today": today
        })
    except Exception as e:
        print(f"DEBUG_STATS_ERROR: {str(e)}")
        return jsonify({"error": str(e)}), 500
    finally:
        master_conn.close()

@auth_bp.route("/admin/settings", methods=["POST"])
@admin_required
def update_admin_settings():
    data = request.json or {}
    master_conn = get_master_db()
    for k, v in data.items():
        master_conn.execute("INSERT OR REPLACE INTO master_settings (key, value) VALUES (?, ?)", (k, str(v)))
    master_conn.commit()
    master_conn.close()
    return jsonify({"ok": True})

@auth_bp.route("/admin/backups", methods=["GET"])
@admin_required
def get_admin_backups():
    master_conn = get_master_db()
    doctors = master_conn.execute("SELECT username, clinic_name FROM doctors").fetchall()
    master_conn.close()
    
    results = []
    for doc in doctors:
        username = doc["username"]
        clinic_name = doc["clinic_name"]
        
        if username == "doctor":
            legacy_root = os.path.join(DB_FOLDER, "clinic.db")
            db_path = legacy_root if os.path.exists(legacy_root) else os.path.join(DB_FOLDER, f"clinic_{username}.db")
        else:
            db_path = os.path.join(DB_FOLDER, f"clinic_{username}.db")
            
        if os.path.exists(db_path):
            size_mb = os.path.getsize(db_path) / (1024 * 1024)
            mtime = os.path.getmtime(db_path)
            last_modified = datetime.datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M:%S")
            status = "Available"
        else:
            size_mb = 0
            last_modified = "N/A"
            status = "Missing"
            
        results.append({
            "username": username,
            "clinic_name": clinic_name,
            "size_mb": round(size_mb, 2),
            "last_modified": last_modified,
            "status": status
        })
        
    return jsonify(results)

@auth_bp.route("/admin/backups/download/<username>", methods=["GET"])
@admin_required
def download_admin_backup(username):
    if username == "doctor":
        legacy_root = os.path.join(DB_FOLDER, "clinic.db")
        db_path = legacy_root if os.path.exists(legacy_root) else os.path.join(DB_FOLDER, f"clinic_{username}.db")
    else:
        db_path = os.path.join(DB_FOLDER, f"clinic_{username}.db")
        
    if os.path.exists(db_path):
        return send_file(db_path, as_attachment=True, download_name=f"clinic_{username}_backup_{datetime.date.today()}.db")
    else:
        return jsonify({"error": "Database file not found"}), 404

@auth_bp.route("/change-password", methods=["POST"])
@token_required
def change_password():
    if request.user.get("role") == "secretary":
        return jsonify({"error": "Secretaries cannot change the main password"}), 403

    data = request.json
    new_p = data.get("password")
    if not new_p: return jsonify({"error": "Missing data"}), 400
    
    hashed_p = generate_password_hash(new_p)
    master_conn = get_master_db()
    master_conn.execute("UPDATE doctors SET password = ? WHERE username = ?", (hashed_p, request.user["username"]))
    master_conn.commit()
    master_conn.close()
    return jsonify({"ok": True})

@auth_bp.route("/secretary", methods=["GET", "POST"])
@token_required
def manage_secretary():
    if request.user.get("role") == "secretary":
        return jsonify({"error": "Access denied"}), 403
        
    u = request.user["username"]
    master_conn = get_master_db()
    
    if request.method == "POST":
        d = request.json
        master_conn.execute("""
            UPDATE doctors SET 
                secretary_enabled = ?, 
                secretary_password = ?
            WHERE username = ?
        """, (d.get('enabled', 0), d.get('password', ''), u))
        master_conn.commit()
        master_conn.close()
        return jsonify({"ok": True})
        
    row = master_conn.execute("SELECT secretary_enabled, secretary_password FROM doctors WHERE username = ?", (u,)).fetchone()
    master_conn.close()
    return jsonify({
        "enabled": row["secretary_enabled"],
        "password": row["secretary_password"]
    })

@auth_bp.route("/doctors/<int:id>", methods=["PUT"])
@admin_required
def update_doctor(id):
    d = request.json
    master_conn = get_master_db()
    
    # Update master info
    master_conn.execute("""
        UPDATE doctors SET 
            clinic_name = ?, 
            expiry_date = ?, 
            status = ?, 
            secretary_enabled = ?, 
            secretary_password = ?
        WHERE id = ?
    """, (d['clinic_name'], d['expiry_date'], d['status'], d['secretary_enabled'], d['secretary_password'], id))
    
    if d.get('password'):
        master_conn.execute("UPDATE doctors SET password = ? WHERE id = ?", (generate_password_hash(d['password']), id))
    
    master_conn.commit()
    
    # Sync settings to clinic DB
    u = master_conn.execute("SELECT username FROM doctors WHERE id = ?", (id,)).fetchone()['username']
    master_conn.close()
    
    try:
        clinic_db = get_db(u)
        if d.get('settings'):
            for k, v in d['settings'].items():
                clinic_db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (k, v))
            clinic_db.commit()
    except Exception as e:
        current_app.logger.error(f"Sync error: {e}")

    return jsonify({"ok": True})

@auth_bp.route("/doctors", methods=["GET"])
@admin_required
def list_doctors():
    master_conn = get_master_db()
    doctors = master_conn.execute("SELECT id, username, clinic_name, expiry_date, status, secretary_enabled, created_at FROM doctors").fetchall()
    master_conn.close()
    return jsonify([dict(d) for d in doctors])

@auth_bp.route("/doctors", methods=["POST"])
@admin_required
def create_doctor():
    data = request.json or {}
    u = data.get("username", "").strip().lower()
    p = data.get("password")
    c = data.get("clinic_name", "عيادة جديدة")
    
    if not u or not p: return jsonify({"error": "Missing fields"}), 400
    
    master_conn = get_master_db()
    existing = master_conn.execute("SELECT id FROM doctors WHERE username = ?", (u,)).fetchone()
    if existing:
        master_conn.close()
        return jsonify({"error": "Username already taken"}), 400
    
    hashed_p = generate_password_hash(p)
    try:
        res = master_conn.execute(
            "INSERT INTO doctors (username, password, clinic_name, status, created_at) VALUES (?, ?, ?, 'active', ?)",
            (u, hashed_p, c, datetime.date.today().isoformat())
        )
        new_id = res.lastrowid
        master_conn.commit()
        
        # Initialize the specific database for this new clinic
        from database import get_db, init_clinic_schema
        new_conn = get_db(u)
        init_clinic_schema(new_conn)
        new_conn.close()
        
        return jsonify({"id": new_id})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        master_conn.close()

@auth_bp.route("/register", methods=["POST"])
def register_doctor():
    data = request.json or {}
    u = data.get("username", "").strip().lower()
    p = data.get("password")
    c = data.get("clinic_name", "عيادة جديدة")
    
    if not u or not p: return jsonify({"error": "Missing fields"}), 400
    
    # Check if username already exists
    master_conn = get_master_db()
    existing = master_conn.execute("SELECT id FROM doctors WHERE username = ?", (u,)).fetchone()
    if existing:
        master_conn.close()
        return jsonify({"error": "Username already taken"}), 400

    hashed_p = generate_password_hash(p)
    try:
        res = master_conn.execute(
            "INSERT INTO doctors (username, password, clinic_name, status, created_at) VALUES (?, ?, ?, 'inactive', ?)",
            (u, hashed_p, c, datetime.date.today().isoformat())
        )
        new_id = res.lastrowid
        master_conn.commit()
        
        # Initialize the specific database for this new clinic
        from database import get_db, init_clinic_schema
        new_conn = get_db(u)
        init_clinic_schema(new_conn)
        new_conn.close()
        
        return jsonify({"id": new_id, "message": "Account created successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        master_conn.close()

@auth_bp.route("/doctors/<int:id>", methods=["DELETE"])
@admin_required
def delete_doctor(id):
    master_conn = get_master_db()
    row = master_conn.execute("SELECT username FROM doctors WHERE id=?", (id,)).fetchone()
    if not row:
        master_conn.close()
        return jsonify({"error": "Doctor not found"}), 404
        
    username = row["username"]
    master_conn.execute("DELETE FROM doctors WHERE id=?", (id,))
    master_conn.commit()
    master_conn.close()
    
    # Completely remove the clinic's database files
    try:
        from database import get_clinic_db_path
        db_path = get_clinic_db_path(username)
        if os.path.exists(db_path):
            os.remove(db_path)
            # Also remove WAL/SHM files to leave no trace
            for ext in ['-wal', '-shm']:
                if os.path.exists(db_path + ext):
                    os.remove(db_path + ext)
            current_app.logger.info(f"DEEP_DELETE: Database for '{username}' has been wiped.")
    except Exception as e:
        current_app.logger.error(f"DEEP_DELETE_ERROR for '{username}': {str(e)}")
        
    return jsonify({"ok": True})
