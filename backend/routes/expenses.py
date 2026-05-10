from flask import Blueprint, request, jsonify, g
from database import db_required, log_action

expenses_bp = Blueprint("expenses", __name__)

@expenses_bp.route("/", methods=["GET"])
@db_required
def get_expenses():
    date_filter = request.args.get("date", "").strip()
    if date_filter:
        rows = g.db.execute("SELECT * FROM expenses WHERE date = ?", (date_filter,)).fetchall()
    else:
        rows = g.db.execute("SELECT * FROM expenses ORDER BY date DESC").fetchall()
    return jsonify([dict(r) for r in rows])

@expenses_bp.route("/", methods=["POST"])
@db_required
def add_expense():
    d = request.json
    g.db.execute("INSERT INTO expenses (category, amount, payment_method, date, notes) VALUES (?,?,?,?,?)",
                 (d['category'], d['amount'], d.get('payment_method', 'Cash'), d['date'], d.get('notes')))
    
    # Audit Log
    log_action("ADD_EXPENSE", target_name=d['category'], description=f"إضافة مصروف جديد: {d['category']} بمبلغ {d['amount']}")
    
    g.db.commit()
    return jsonify({"ok": True})

@expenses_bp.route("/<int:id>", methods=["DELETE"])
@db_required
def delete_expense(id):
    # Get info before delete for logging
    row = g.db.execute("SELECT category, amount FROM expenses WHERE id=?", (id,)).fetchone()
    if row:
        log_action("DELETE_EXPENSE", target_name=row['category'], description=f"حذف مصروف: {row['category']} بقيمة {row['amount']}")
    
    g.db.execute("DELETE FROM expenses WHERE id = ?", (id,))
    g.db.commit()
    return jsonify({"ok": True})
