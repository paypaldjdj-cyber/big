from flask import Blueprint, request, jsonify, g
from database import db_required, log_action
import datetime

inventory_bp = Blueprint("inventory", __name__)

@inventory_bp.route("/", methods=["GET"])
@db_required
def get_inventory():
    rows = g.db.execute("SELECT * FROM inventory_items ORDER BY category, name").fetchall()
    items = []
    for r in rows:
        items.append({
            "id": r['id'],
            "name": r['name'],
            "category": r['category'],
            "stock": r['stock_quantity'],
            "min_stock": r['min_quantity'],
            "unit": r['unit'],
            "price": r['purchase_price'],
            "last_updated": r['last_updated']
        })
    return jsonify(items)

@inventory_bp.route("/", methods=["POST"])
@db_required
def add_item():
    data = request.json
    name = data.get("name")
    category = data.get("category", "General")
    stock = float(data.get("stock", 0))
    price = float(data.get("price", 0))
    min_stock = float(data.get("min_stock", 5))
    unit = data.get("unit", "Piece")
    
    try:
        g.db.execute("""
            INSERT INTO inventory_items (name, category, stock_quantity, min_quantity, unit, purchase_price)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (name, category, stock, min_stock, unit, price))
        
        # Log Expense if stock > 0 and price > 0
        if stock > 0 and price > 0:
            total_cost = stock * price
            today = datetime.date.today().isoformat()
            g.db.execute("""
                INSERT INTO expenses (category, amount, payment_method, date, notes)
                VALUES (?, ?, 'Cash', ?, ?)
            """, ("Inventory Purchase", total_cost, today, f"Initial stock for: {name}"))
            
        g.db.commit()
        log_action("ADD_INVENTORY_ITEM", target_name=name, description=f"إضافة مادة جديدة للمخزن: {name} بكمية {stock}")
        return jsonify({"ok": True}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@inventory_bp.route("/<int:iid>", methods=["PUT"])
@db_required
def update_item(iid):
    data = request.json
    try:
        g.db.execute("""
            UPDATE inventory_items SET name=?, category=?, stock_quantity=?, min_quantity=?, unit=?, purchase_price=?, last_updated=CURRENT_TIMESTAMP
            WHERE id=?
        """, (data.get("name"), data.get("category"), data.get("stock"), data.get("min_stock"), data.get("unit"), data.get("price"), iid))
        g.db.commit()
        log_action("UPDATE_INVENTORY_ITEM", target_id=iid, target_name=data.get("name"), description=f"تعديل بيانات مادة في المخزن: {data.get('name')}")
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@inventory_bp.route("/<int:iid>/stock", methods=["POST"])
@db_required
def update_stock(iid):
    data = request.json
    change = float(data.get("change", 0))
    try:
        # Get item price for expense logging
        item = g.db.execute("SELECT name, purchase_price FROM inventory_items WHERE id = ?", (iid,)).fetchone()
        if not item: return jsonify({"error": "Item not found"}), 404
        
        g.db.execute("UPDATE inventory_items SET stock_quantity = stock_quantity + ?, last_updated=CURRENT_TIMESTAMP WHERE id = ?", (change, iid))
        
        # Log Expense if change is positive (restocking)
        if change > 0 and item['purchase_price'] > 0:
            total_cost = change * item['purchase_price']
            today = datetime.date.today().isoformat()
            g.db.execute("""
                INSERT INTO expenses (category, amount, payment_method, date, notes)
                VALUES (?, ?, 'Cash', ?, ?)
            """, ("Inventory Purchase", total_cost, today, f"Restocked: {item['name']} (+{change})"))
            
        g.db.commit()
        action_type = "INCREASE_STOCK" if change > 0 else "DECREASE_STOCK"
        desc = f"زيادة كمية {item['name']} بـ {change}" if change > 0 else f"استهلاك/تنقيص {item['name']} بـ {abs(change)}"
        log_action(action_type, target_id=iid, target_name=item['name'], description=desc)
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@inventory_bp.route("/<int:iid>", methods=["DELETE"])
@db_required
def delete_item(iid):
    # Get name before delete
    item = g.db.execute("SELECT name FROM inventory_items WHERE id=?", (iid,)).fetchone()
    name = item['name'] if item else f"Item #{iid}"
    
    g.db.execute("DELETE FROM inventory_items WHERE id = ?", (iid,))
    log_action("DELETE_INVENTORY_ITEM", target_id=iid, target_name=name, description=f"حذف مادة من المخزن: {name}")
    g.db.commit()
    return jsonify({"ok": True})
