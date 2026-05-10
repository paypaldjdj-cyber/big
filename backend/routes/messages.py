from flask import Blueprint, request, jsonify, g
from database import get_db, log_action
from routes.auth import token_required
import datetime
import os
from werkzeug.utils import secure_filename

# Use absolute path to avoid CWD issues
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads', 'chat')

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

messages_bp = Blueprint("messages", __name__)

@messages_bp.route("/", methods=["GET"])
@token_required
def get_messages():
    username = request.user.get("username")
    conn = get_db(username)
    messages = conn.execute("SELECT * FROM internal_messages ORDER BY created_at ASC").fetchall()
    conn.close()
    return jsonify([dict(m) for m in messages])

@messages_bp.route("/upload", methods=["POST"])
@token_required
def upload_image():
    print("CHAT_UPLOAD: Attempt started...")
    if 'image' not in request.files:
        print("CHAT_UPLOAD: No image in request.files")
        return jsonify({"error": "No image"}), 400
    file = request.files['image']
    if file.filename == '':
        print("CHAT_UPLOAD: Empty filename")
        return jsonify({"error": "Empty filename"}), 400
    
    try:
        filename = secure_filename(f"{datetime.datetime.now().timestamp()}_{file.filename}")
        path = os.path.join(UPLOAD_FOLDER, filename)
        file.save(path)
        print(f"CHAT_UPLOAD: Saved to {path}")
        
        # Return accessible URL
        url = f"/api/messages/images/{filename}"
        return jsonify({"url": url})
    except Exception as e:
        print(f"CHAT_UPLOAD: Error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@messages_bp.route("/images/<filename>")
def serve_chat_image(filename):
    from flask import send_from_directory
    return send_from_directory(UPLOAD_FOLDER, filename)

@messages_bp.route("/", methods=["POST"])
@token_required
def send_message():
    username = request.user.get("username")
    role = request.user.get("role")
    data = request.json
    content = data.get("content")
    image_url = data.get("image_url")
    
    if not content and not image_url:
        return jsonify({"error": "Content or Image required"}), 400
        
    conn = get_db(username)
    try:
        conn.execute("INSERT INTO internal_messages (sender_role, content, image_url) VALUES (?, ?, ?)", (role, content, image_url))
    except Exception as e:
        if "no column named image_url" in str(e):
            print("AUTO_MIGRATE: Adding image_url column...")
            try:
                conn.execute("ALTER TABLE internal_messages ADD COLUMN image_url TEXT")
                conn.execute("INSERT INTO internal_messages (sender_role, content, image_url) VALUES (?, ?, ?)", (role, content, image_url))
            except Exception as e2:
                conn.close()
                return jsonify({"error": f"Migration failed: {str(e2)}"}), 500
        else:
            conn.close()
            return jsonify({"error": str(e)}), 500
            
    conn.commit()
    conn.close()
    
    return jsonify({"ok": True})

@messages_bp.route("/mark-read", methods=["POST"])
@token_required
def mark_read():
    username = request.user.get("username")
    role = request.user.get("role")
    conn = get_db(username)
    # Only mark as read if the message was NOT sent by the current role
    conn.execute("UPDATE internal_messages SET is_read = 1 WHERE is_read = 0 AND sender_role != ?", (role,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})
