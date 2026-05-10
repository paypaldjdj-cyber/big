import os
from flask import Flask, send_from_directory, jsonify, g, request
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from database import init_db

# Load blueprints
from routes.patients import patients_bp
from routes.appointments import appointments_bp
from routes.invoices import invoices_bp
from routes.settings import settings_bp
from routes.expenses import expenses_bp
from routes.auth import auth_bp
from routes.stats import stats_bp
from routes.drugs import drugs_bp
from routes.prescriptions import prescriptions_bp
from routes.inventory import inventory_bp
from routes.messages import messages_bp

from extensions import limiter
from dotenv import load_dotenv

load_dotenv()

# Set static folder to the absolute path of frontend/dist
static_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))
app = Flask(__name__, static_folder=static_path)

# Debug Fallbacks to prevent crash on Railway if ENV is missing
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "debug-secret-key-123")
ADMIN_PASS = os.getenv("ADMIN_PASSWORD", "admin123")

# Initialize Extensions
limiter.init_app(app)

from apscheduler.schedulers.background import BackgroundScheduler
from cloud_backup import run_daily_company_backup
from database import cleanup_old_tokens

scheduler = BackgroundScheduler()
scheduler.add_job(func=run_daily_company_backup, trigger="cron", hour=2, minute=0)
scheduler.add_job(func=cleanup_old_tokens, trigger="cron", hour=3, minute=0)
scheduler.start()

# Total Open CORS for Debugging
CORS(app, resources={r"/*": {"origins": "*"}})

# --- API BLUEPRINTS ---
app.register_blueprint(auth_bp,         url_prefix="/api/auth")
app.register_blueprint(patients_bp,     url_prefix="/api/patients")
app.register_blueprint(appointments_bp, url_prefix="/api/appointments")
app.register_blueprint(invoices_bp,     url_prefix="/api/invoices")
app.register_blueprint(settings_bp,     url_prefix="/api/settings")
app.register_blueprint(expenses_bp,     url_prefix="/api/expenses")
app.register_blueprint(stats_bp,        url_prefix="/api/stats")
app.register_blueprint(drugs_bp,        url_prefix="/api/drugs")
app.register_blueprint(prescriptions_bp,url_prefix="/api/prescriptions")
app.register_blueprint(inventory_bp,    url_prefix="/api/inventory")
app.register_blueprint(messages_bp,     url_prefix="/api/messages")

@app.route('/api/health')
def health():
    return jsonify({
        "status": "healthy",
        "env_check": {
            "secret_key_set": os.getenv("SECRET_KEY") is not None,
            "admin_pass_set": os.getenv("ADMIN_PASSWORD") is not None
        }
    }), 200

from werkzeug.exceptions import HTTPException

@app.errorhandler(Exception)
def handle_exception(e):
    app.logger.error(f"SYSTEM ERROR: {str(e)}")
    return jsonify({"error": str(e)}), 500

@app.route('/api/uploads/<path:filename>')
def uploaded_file(filename):
    UPLOAD_FOLDER = os.path.join(app.root_path, "static", "uploads")
    if not os.path.exists(UPLOAD_FOLDER): os.makedirs(UPLOAD_FOLDER)
    return send_from_directory(UPLOAD_FOLDER, filename)

# --- DEBUG ROOT ROUTE (TEMPORARY TO VERIFY SYNC) ---
@app.route('/')
def index():
    return f"<h1>SmileCare SYNCED at {os.getenv('RAILWAY_STATIC_URL', 'Cloud')}</h1><p>If you see this, the code is updated. Testing path: {app.static_folder}</p>", 200

# --- CATCH-ALL FOR FRONTEND ---
@app.route('/<path:path>')
def serve(path):
    if path.startswith("api/"):
        return jsonify({"error": f"API endpoint '{path}' not found"}), 404
    
    if path != "" and os.path.exists(app.static_folder + '/' + path):
        return send_from_directory(app.static_folder, path)
        
    return send_from_directory(app.static_folder, 'index.html')

# Initialize DB
try:
    init_db()
except Exception as e:
    app.logger.error(f"DB INIT FAILED: {str(e)}")

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5050))
    app.run(host="0.0.0.0", port=port)


