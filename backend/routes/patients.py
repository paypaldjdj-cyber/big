import json
import os
import uuid
import datetime
from flask import Blueprint, request, jsonify, g
from database import db_required, log_action

patients_bp = Blueprint("patients", __name__)

@patients_bp.route("/treatments/all", methods=["GET"])
@db_required
def get_all_treatments():
    date_filter = request.args.get("date", "")
    query = """
        SELECT t.*, p.first_name || ' ' || p.last_name AS patient_name
        FROM treatment_logs t
        JOIN patients p ON t.patient_id = p.id
        WHERE 1=1
    """
    params = []
    if date_filter:
        query += " AND t.date = ?"
        params.append(date_filter)
    
    query += " ORDER BY t.date DESC, t.id DESC"
    rows = g.db.execute(query, params).fetchall()
    return jsonify([dict(r) for r in rows])

@patients_bp.route("/prescriptions/all", methods=["GET"])
@db_required
def get_all_prescriptions():
    query = """
        SELECT pr.*, p.first_name || ' ' || p.last_name AS patient_name
        FROM prescriptions pr
        JOIN patients p ON pr.patient_id = p.id
        ORDER BY pr.date DESC
    """
    rows = g.db.execute(query).fetchall()
    return jsonify([dict(r) for r in rows])

@patients_bp.route("/", methods=["GET"])
@db_required
def get_patients():
    q = request.args.get("q", "")
    status = request.args.get("status", "")
    date_filter = request.args.get("date", "")
    page = int(request.args.get("page", 1))
    limit = int(request.args.get("limit", 50))
    offset = (page - 1) * limit
    
    query = """
        SELECT p.*, p.total_agreed_price AS total_price, MAX(a.date) as last_visit
        FROM patients p
        LEFT JOIN appointments a ON p.id = a.patient_id
        WHERE (p.first_name LIKE ? OR p.last_name LIKE ? OR p.phone LIKE ?)
    """
    params = [f"%{q}%", f"%{q}%", f"%{q}%"]
    
    if status:
        query += " AND p.status = ?"
        params.append(status)

    if date_filter:
        query += " AND p.created_at = ?"
        params.append(date_filter)
        
    query += " GROUP BY p.id ORDER BY p.id DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])
    
    rows = g.db.execute(query, params).fetchall()
    return jsonify([dict(r) for r in rows])

@patients_bp.route("/<int:id>", methods=["PUT"])
@db_required
def update_patient(id):
    d = request.json
    fields = [
        'first_name', 'last_name', 'phone', 'birth_date', 'age', 'gender', 
        'occupation', 'address', 'systemic_conditions', 'notes', 
        'case_category', 'is_ongoing', 'status', 'case_notes', 'case_images',
        'payment_system', 'total_agreed_price'
    ]
    
    # Map arrays to strings if they exist
    if 'case_notes' in d and isinstance(d['case_notes'], (list, dict)):
        d['case_notes'] = json.dumps(d['case_notes'])
    if 'case_images' in d and isinstance(d['case_images'], (list, dict)):
        d['case_images'] = json.dumps(d['case_images'])

    set_clause = ", ".join([f"{f} = ?" for f in fields if f in d])
    values = [d[f] for f in fields if f in d]
    values.append(id)
    
    if set_clause:
        # Get old data for diff
        old_row = g.db.execute(f"SELECT * FROM patients WHERE id = ?", (id,)).fetchone()
        old_data = dict(old_row) if old_row else {}
        
        sql = f"UPDATE patients SET {set_clause} WHERE id = ?"
        g.db.execute(sql, values)
        
        # Get new data for diff
        new_row = g.db.execute(f"SELECT * FROM patients WHERE id = ?", (id,)).fetchone()
        new_data = dict(new_row) if new_row else {}
        
        # Audit Log with Diff
        p_name = f"{new_data.get('first_name', '')} {new_data.get('last_name', '')}".strip()
        log_action("UPDATE_PATIENT", target_id=id, target_name=p_name, 
                   description=f"تعديل بيانات المريض", 
                   old_data=old_data, new_data=new_data)

    if 'total_agreed_price' in d:
        # Check if an invoice exists for this patient, just to ensure they have an opening balance
        inv = g.db.execute("SELECT id FROM invoices WHERE patient_id = ?", (id,)).fetchone()
        if not inv and d['total_agreed_price'] > 0:
            # Create a default empty invoice so that they show up in debts if needed
            g.db.execute("INSERT INTO invoices (patient_id, agreed_price, amount, status, date) VALUES (?, ?, ?, ?, CURRENT_DATE)", 
                         (id, d['total_agreed_price'], 0, 'غير مدفوع'))

    g.db.commit()
    return jsonify({"ok": True})

@patients_bp.route("/", methods=["POST"])
@db_required
def add_patient():
    d = request.json
    fields = [
        'first_name', 'last_name', 'phone', 'birth_date', 'age', 'gender', 
        'occupation', 'address', 'systemic_conditions', 'notes', 
        'case_category', 'is_ongoing', 'status', 'payment_system', 'total_agreed_price'
    ]
    
    # Use default values if missing
    values = [d.get(f, "") for f in fields]
    if not d.get('status'): values[fields.index('status')] = 'جديد'

    placeholders = ", ".join(["?"] * len(fields))
    col_names = ", ".join(fields)
    
    sql = f"INSERT INTO patients ({col_names}) VALUES ({placeholders})"
    cur = g.db.execute(sql, values)
    new_id = cur.lastrowid
    
    # Audit Log
    p_name = f"{d.get('first_name', '')} {d.get('last_name', '')}".strip()
    log_action("CREATE_PATIENT", target_id=new_id, target_name=p_name, description=f"إضافة مريض جديد للنظام")
    
    g.db.commit()
    return jsonify({"id": new_id})

import json

@patients_bp.route("/<int:id>", methods=["GET"])
@db_required
def get_patient(id):
    p = g.db.execute("SELECT * FROM patients WHERE id=?", (id,)).fetchone()
    if not p: return jsonify({"error": "NotFound"}), 404
    res = dict(p)
    
    # Get last 10 appointments
    res['visits'] = [dict(r) for r in g.db.execute("SELECT * FROM appointments WHERE patient_id=? ORDER BY date DESC LIMIT 10", (id,)).fetchall()]
    
    # Get invoices with aliases for frontend
    inv_query = "SELECT id, total_amount AS amount, paid_amount AS paid, date, status, payment_method FROM invoices WHERE patient_id=? ORDER BY date DESC"
    res['invoices'] = [dict(r) for r in g.db.execute(inv_query, (id,)).fetchall()]
    
    # Get prescriptions
    res['prescriptions'] = [dict(r) for r in g.db.execute("SELECT * FROM prescriptions WHERE patient_id=? ORDER BY date DESC", (id,)).fetchall()]
    
    def safe_json(s):
        try:
            return json.loads(s) if s else []
        except:
            return []

    tm = g.db.execute("SELECT map_data FROM teeth_map WHERE patient_id=?", (id,)).fetchone()
    res['teeth'] = safe_json(tm['map_data']) if tm else []
    res['case_notes'] = safe_json(res.get('case_notes'))
    res['case_images'] = safe_json(res.get('case_images'))
    
    # Get treatments
    res['treatments'] = [dict(r) for r in g.db.execute("SELECT * FROM treatment_logs WHERE patient_id=? ORDER BY date DESC", (id,)).fetchall()]
    
    return jsonify(res)

@patients_bp.route("/<int:id>/teeth", methods=["POST"])
@db_required
def update_teeth(id):
    data = json.dumps(request.json)
    g.db.execute("INSERT OR REPLACE INTO teeth_map (patient_id, map_data) VALUES (?, ?)", (id, data))
    
    # Audit Log
    p = g.db.execute("SELECT first_name, last_name FROM patients WHERE id=?", (id,)).fetchone()
    p_name = f"{p['first_name']} {p['last_name']}" if p else "Unknown"
    log_action("UPDATE_TEETH", target_id=id, target_name=p_name, description="تعديل وحفظ خريطة الأسنان")
    
    g.db.commit()
    return jsonify({"ok": True})

import os
import uuid
import datetime

@patients_bp.route("/<int:id>/prescriptions", methods=["POST"])
@db_required
def add_prescription(id):
    # Support both JSON and multipart/form-data
    if request.is_json:
        d = request.json
        image_url = d.get('image_url', '')
        date = d.get('date', datetime.date.today().isoformat())
        meds = d.get('meds', '')
        notes = d.get('notes', '')
    else:
        # File upload
        date = request.form.get('date', datetime.date.today().isoformat())
        meds = request.form.get('meds', '')
        notes = request.form.get('notes', '')
        image_url = ''
        
        if 'image' in request.files:
            file = request.files['image']
            if file.filename != '':
                ext = file.filename.rsplit('.', 1)[1].lower()
                if ext not in {'png', 'jpg', 'jpeg', 'pdf'}:
                    return jsonify({"error": "نوع الملف غير مدعوم. مسموح فقط بـ PNG, JPG, JPEG, PDF"}), 400
                filename = f"presc_{id}_{uuid.uuid4().hex}.{ext}"
                upload_path = os.path.join(os.path.dirname(__file__), "..", "static", "uploads", filename)
                file.save(upload_path)
                image_url = f"/uploads/{filename}"

    g.db.execute("INSERT INTO prescriptions (patient_id, meds, notes, date, image_url) VALUES (?, ?, ?, ?, ?)",
                 (id, meds, notes, date, image_url))
    g.db.commit()
    return jsonify({"ok": True, "image_url": image_url})

@patients_bp.route("/prescriptions/<int:presc_id>", methods=["DELETE"])
@db_required
def delete_prescription(presc_id):
    g.db.execute("DELETE FROM prescriptions WHERE id = ?", (presc_id,))
    g.db.commit()
    return jsonify({"ok": True})

@patients_bp.route("/prescriptions/<int:presc_id>", methods=["PUT"])
@db_required
def update_prescription(presc_id):
    d = request.json
    g.db.execute("UPDATE prescriptions SET meds = ?, notes = ?, date = ? WHERE id = ?",
                 (d.get('meds', ''), d.get('notes', ''), d.get('date', ''), presc_id))
    g.db.commit()
    return jsonify({"ok": True})

@patients_bp.route("/<int:id>/treatments", methods=["POST"])
@db_required
def add_treatment(id):
    d = request.json
    g.db.execute("""
        INSERT INTO treatment_logs (patient_id, tooth_number, procedure, notes, cost, date)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (id, d.get('tooth_number'), d.get('procedure'), d.get('notes'), d.get('cost', 0), d.get('date', datetime.date.today().isoformat())))
    
    # Audit Log
    p = g.db.execute("SELECT first_name, last_name FROM patients WHERE id=?", (id,)).fetchone()
    p_name = f"{p['first_name']} {p['last_name']}" if p else "Unknown"
    log_action("ADD_TREATMENT", target_id=id, target_name=p_name, description=f"إضافة إجراء علاجي: {d.get('procedure')} للسن {d.get('tooth_number')}")
    
    g.db.commit()
    return jsonify({"ok": True})

@patients_bp.route("/treatments/<int:tid>", methods=["DELETE"])
@db_required
def delete_treatment(tid):
    g.db.execute("DELETE FROM treatment_logs WHERE id = ?", (tid,))
    g.db.commit()
    return jsonify({"ok": True})

@patients_bp.route("/<int:id>", methods=["DELETE"])
@db_required
def delete_patient(id):
    # Get info before delete for logging
    p = g.db.execute("SELECT first_name, last_name FROM patients WHERE id=?", (id,)).fetchone()
    if p:
        p_name = f"{p['first_name']} {p['last_name']}"
        log_action("DELETE_PATIENT", target_id=id, target_name=p_name, description="حذف ملف المريض بالكامل من النظام")
    
    g.db.execute("DELETE FROM patients WHERE id = ?", (id,))
    # Clean up related data (optional but recommended)
    g.db.execute("DELETE FROM appointments WHERE patient_id = ?", (id,))
    g.db.execute("DELETE FROM invoices WHERE patient_id = ?", (id,))
    g.db.execute("DELETE FROM teeth_map WHERE patient_id = ?", (id,))
    g.db.execute("DELETE FROM treatment_logs WHERE patient_id = ?", (id,))
    g.db.execute("DELETE FROM prescriptions WHERE patient_id = ?", (id,))
    
    g.db.commit()
    return jsonify({"ok": True})
@patients_bp.route("/<int:id>/report-pdf", methods=["GET"])
@db_required
def download_patient_report_pdf(id):
    from flask import send_file
    import io
    from pdf_utils import get_pdf_styles, add_header_footer, force_english
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
    from reportlab.lib.units import mm
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    import json

    p = g.db.execute("SELECT * FROM patients WHERE id=?", (id,)).fetchone()
    if not p: return jsonify({"error": "NotFound"}), 404

    treatments = g.db.execute("SELECT * FROM treatment_logs WHERE patient_id=? ORDER BY date DESC", (id,)).fetchall()
    invoices = g.db.execute("SELECT * FROM invoices WHERE patient_id=? ORDER BY date DESC", (id,)).fetchall()
    
    settings_rows = g.db.execute("SELECT key, value FROM settings").fetchall()
    clinic = {row["key"]: row["value"] for row in settings_rows}

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=60*mm, bottomMargin=45*mm)
    styles = get_pdf_styles()
    story = []

    story.append(Paragraph(f"Patient Medical Report", styles["title"]))
    story.append(Spacer(1, 10*mm))

    # Basic Info Table
    story.append(Paragraph("Patient Information", styles["label"]))
    info_data = [
        ["Full Name:", force_english(f"{p['first_name']} {p['last_name']}")],
        ["Phone:", p['phone']],
        ["Age / Gender:", f"{p['age']} / {p['gender']}"],
        ["Occupation:", force_english(p['occupation']) or "-"],
        ["Conditions:", force_english(p['systemic_conditions']) or "None"]
    ]
    for lbl, val in info_data:
        story.append(Table([[Paragraph(lbl, styles["normal"]), Paragraph(val, styles["value"])]], colWidths=[40*mm, 130*mm]))

    story.append(Spacer(1, 10*mm))

    # Treatments
    story.append(Paragraph("Treatment History", styles["label"]))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#185FA5")))
    story.append(Spacer(1, 4*mm))
    
    if treatments:
        t_data = [["Date", "Tooth", "Procedure", "Cost"]]
        for t in treatments:
            t_data.append([t['date'], str(t['tooth_number']), force_english(t['procedure']), f"{t['cost']:,.0f}"])
        
        tt = Table(t_data, colWidths=[30*mm, 20*mm, 90*mm, 30*mm])
        tt.setStyle(TableStyle([('BACKGROUND', (0,0), (-1,0), colors.whitesmoke), ('LINEBELOW', (0,0), (-1,-1), 0.5, colors.lightgrey), ('PADDING', (0,0), (-1,-1), 6)]))
        story.append(tt)
    else:
        story.append(Paragraph("No treatments recorded.", styles["normal"]))

    story.append(Spacer(1, 10*mm))

    # Financial Status
    story.append(Paragraph("Financial History (Payments)", styles["label"]))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#10b981")))
    story.append(Spacer(1, 4*mm))
    
    if invoices:
        inv_data = [["Date", "Status", "Method", "Paid Amount"]]
        for inv in invoices:
            inv_data.append([inv['date'], force_english(inv['status']), inv['payment_method'], f"{inv['paid_amount']:,.0f}"])
        
        it = Table(inv_data, colWidths=[35*mm, 35*mm, 40*mm, 60*mm])
        it.setStyle(TableStyle([('BACKGROUND', (0,0), (-1,0), colors.whitesmoke), ('LINEBELOW', (0,0), (-1,-1), 0.5, colors.lightgrey), ('PADDING', (0,0), (-1,-1), 6)]))
        story.append(it)
        
        total_paid = sum(i['paid_amount'] for i in invoices)
        story.append(Spacer(1, 5*mm))
        story.append(Paragraph(f"<b>Total Amount Paid: {total_paid:,.0f} IQD</b>", styles["value"]))
    else:
        story.append(Paragraph("No payments recorded.", styles["normal"]))

    doc.build(story, onFirstPage=lambda c, d: add_header_footer(c, d, clinic), onLaterPages=lambda c, d: add_header_footer(c, d, clinic))
    buf.seek(0)
    return send_file(buf, mimetype="application/pdf", as_attachment=True, download_name=f"report_{id}.pdf")
