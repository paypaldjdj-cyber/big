from flask import Blueprint, request, jsonify, g
from database import db_required
from datetime import datetime

stats_bp = Blueprint("stats", __name__)

@stats_bp.route("/summary", methods=["GET"])
@db_required
def get_summary():
    today = datetime.now().strftime("%Y-%m-%d")
    
    # Appointments today
    total_today = g.db.execute("SELECT COUNT(*) FROM appointments WHERE date = ?", (today,)).fetchone()[0]
    
    # Total Patients
    total_patients = g.db.execute("SELECT COUNT(*) FROM patients").fetchone()[0]
    
    # Debt Calculation
    debt_query = "SELECT SUM(debt) FROM patients WHERE debt > 0"
    debt_total = g.db.execute(debt_query).fetchone()[0] or 0
    
    # Debt Count
    debt_count_query = "SELECT COUNT(*) FROM patients WHERE debt > 0"
    debt_count = g.db.execute(debt_count_query).fetchone()[0]
    
    return jsonify({
        "total_today": total_today,
        "debt_total": debt_total,
        "total_patients": total_patients,
        "debt_count": debt_count
    })

@stats_bp.route("/financial", methods=["GET"])
@db_required
def get_financial():
    today = datetime.now().strftime("%Y-%m-%d")
    month = datetime.now().strftime("%Y-%m")
    
    # Revenue (Collected) — use local date
    collected_today = g.db.execute(
        "SELECT SUM(paid_amount) FROM invoices WHERE date = ? AND paid_amount > 0", 
        (today,)
    ).fetchone()[0] or 0
    collected_month = g.db.execute(
        "SELECT SUM(paid_amount) FROM invoices WHERE date LIKE ? AND paid_amount > 0", 
        (f"{month}%",)
    ).fetchone()[0] or 0
    total_revenue = g.db.execute("SELECT SUM(paid_amount) FROM invoices").fetchone()[0] or 0
    
    # Expenses
    total_expenses = g.db.execute("SELECT SUM(amount) FROM expenses").fetchone()[0] or 0
    expenses_today = g.db.execute("SELECT SUM(amount) FROM expenses WHERE date = ?", (today,)).fetchone()[0] or 0
    
    # Cash vs Bank (Collected Revenue)
    cash_collected = g.db.execute("SELECT SUM(paid_amount) FROM invoices WHERE payment_method = 'Cash'").fetchone()[0] or 0
    bank_collected = g.db.execute("SELECT SUM(paid_amount) FROM invoices WHERE payment_method = 'Bank'").fetchone()[0] or 0
    
    cash_expenses = g.db.execute("SELECT SUM(amount) FROM expenses WHERE payment_method = 'Cash'").fetchone()[0] or 0
    bank_expenses = g.db.execute("SELECT SUM(amount) FROM expenses WHERE payment_method = 'Bank'").fetchone()[0] or 0
    
    cash_balance = cash_collected - cash_expenses
    bank_balance = bank_collected - bank_expenses
    
    # Debt logic
    agreed_total_query = """
        SELECT SUM(total_amt) FROM (
            SELECT CASE 
                     WHEN p.payment_system = 'sessions' THEN COALESCE(SUM(i.total_amount), 0) 
                     ELSE COALESCE(p.total_agreed_price, 0) 
                   END as total_amt
            FROM patients p
            LEFT JOIN invoices i ON p.id = i.patient_id
            GROUP BY p.id
        )
    """
    agreed_total = g.db.execute(agreed_total_query).fetchone()[0] or 0
    total_debt = agreed_total - total_revenue
    
    # Collection Rate
    collection_rate = (total_revenue / agreed_total * 100) if agreed_total > 0 else 100

    # Monthly Growth (Last 6 Months)
    monthly_growth = []
    current_m = datetime.now().month
    current_y = datetime.now().year
    
    for i in range(5, -1, -1):
        m = current_m - i
        y = current_y
        if m <= 0:
            m += 12
            y -= 1
        m_str = f"{y}-{m:02d}"
        rev = g.db.execute("SELECT SUM(paid_amount) FROM invoices WHERE date LIKE ?", (f"{m_str}%",)).fetchone()[0] or 0
        monthly_growth.append({"name": f"{m:02d}/{y}", "revenue": rev})

    return jsonify({
        "collected_today": collected_today,
        "collected_month": collected_month,
        "expenses_today": expenses_today,
        "revenue": total_revenue,
        "expenses": total_expenses,
        "net_profit": total_revenue - total_expenses,
        "total_debt": total_debt,
        "cash_revenue": cash_balance,
        "bank_revenue": bank_balance,
        "collection_rate": round(collection_rate, 1),
        "monthly_growth": monthly_growth
    })

@stats_bp.route("/debts", methods=["GET"])
@db_required
def get_debts():
    query = """
        SELECT p.id, p.first_name, p.last_name, p.phone, p.payment_system, p.debt,
               (CASE WHEN p.payment_system = 'sessions' THEN COALESCE((SELECT SUM(cost) FROM treatment_logs WHERE patient_id = p.id), 0) ELSE COALESCE(p.total_agreed_price, 0) END) AS total_price
        FROM patients p
        WHERE p.debt > 0
        ORDER BY p.debt DESC
    """
    rows = g.db.execute(query).fetchall()
    return jsonify([dict(r) for r in rows])

@stats_bp.route("/invoices/summary", methods=["GET"])
@db_required
def get_invoice_summary():
    # Calculate sum of agreed_price per patient
    today = datetime.now().strftime("%Y-%m-%d")
    
    agreed_total_query = """
        SELECT SUM(
            CASE 
                WHEN p.payment_system = 'sessions' THEN COALESCE((SELECT SUM(cost) FROM treatment_logs WHERE patient_id = p.id), 0)
                ELSE COALESCE(p.total_agreed_price, 0) 
            END
        ) FROM patients p
    """
    agreed_total = g.db.execute(agreed_total_query).fetchone()[0] or 0
    total_collected = g.db.execute("SELECT SUM(paid_amount) FROM invoices").fetchone()[0] or 0
    
    today_total = g.db.execute("SELECT SUM(total_amount) FROM invoices WHERE date = ?", (today,)).fetchone()[0] or 0
    today_collected = g.db.execute("SELECT SUM(paid_amount) FROM invoices WHERE date = ?", (today,)).fetchone()[0] or 0

    return jsonify({
        "total": agreed_total,
        "collected": total_collected,
        "debt": agreed_total - total_collected,
        "today_total": today_total,
        "today_collected": today_collected
    })
@stats_bp.route("/daily-summary/pdf", methods=["GET"])
@db_required
def download_daily_summary_pdf():
    from flask import send_file
    import io
    from pdf_utils import get_pdf_styles, add_header_footer, force_english
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
    from reportlab.lib.units import mm
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from datetime import datetime

    today = datetime.now().strftime("%Y-%m-%d")
    
    # Financial data
    rev_rows = g.db.execute("SELECT i.*, p.first_name || ' ' || p.last_name as p_name FROM invoices i JOIN patients p ON i.patient_id = p.id WHERE i.date = ?", (today,)).fetchall()
    exp_rows = g.db.execute("SELECT * FROM expenses WHERE date = ?", (today,)).fetchall()
    
    total_rev = sum(r['paid_amount'] for r in rev_rows)
    total_exp = sum(r['amount'] for r in exp_rows)

    settings_rows = g.db.execute("SELECT key, value FROM settings").fetchall()
    clinic = {row["key"]: row["value"] for row in settings_rows}

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=60*mm, bottomMargin=45*mm)
    styles = get_pdf_styles()
    story = []

    story.append(Paragraph(f"Daily Financial Summary - {today}", styles["title"]))
    story.append(Spacer(1, 10*mm))

    # Revenue Table
    story.append(Paragraph("Revenue (Payments Received)", styles["label"]))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#10b981")))
    story.append(Spacer(1, 4*mm))
    
    if rev_rows:
        rev_data = [["Patient", "Method", "Amount"]]
        for r in rev_rows:
            rev_data.append([force_english(r['p_name']), r['payment_method'], f"{r['paid_amount']:,.0f}"])
        
        rt = Table(rev_data, colWidths=[100*mm, 35*mm, 35*mm])
        rt.setStyle(TableStyle([('BACKGROUND', (0,0), (-1,0), colors.whitesmoke), ('LINEBELOW', (0,0), (-1,-1), 0.5, colors.lightgrey), ('PADDING', (0,0), (-1,-1), 6)]))
        story.append(rt)
    else:
        story.append(Paragraph("No revenue recorded today.", styles["normal"]))

    story.append(Spacer(1, 15*mm))

    # Expenses Table
    story.append(Paragraph("Expenses (Payments Made)", styles["label"]))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#ef4444")))
    story.append(Spacer(1, 4*mm))
    
    if exp_rows:
        exp_data = [["Category", "Description", "Amount"]]
        for e in exp_rows:
            exp_data.append([force_english(e['category']), force_english(e['description']), f"{e['amount']:,.0f}"])
        
        et = Table(exp_data, colWidths=[40*mm, 95*mm, 35*mm])
        et.setStyle(TableStyle([('BACKGROUND', (0,0), (-1,0), colors.whitesmoke), ('LINEBELOW', (0,0), (-1,-1), 0.5, colors.lightgrey), ('PADDING', (0,0), (-1,-1), 6)]))
        story.append(et)
    else:
        story.append(Paragraph("No expenses recorded today.", styles["normal"]))

    story.append(Spacer(1, 20*mm))
    
    # Final Totals
    total_data = [
        ["Total Revenue:", f"{total_rev:,.0f} IQD"],
        ["Total Expenses:", f"{total_exp:,.0f} IQD"],
        ["Net Cash Flow:", f"{(total_rev - total_exp):,.0f} IQD"]
    ]
    for lbl, val in total_data:
        row = [Paragraph(f"<b>{lbl}</b>", styles["normal"]), Paragraph(f"<b>{val}</b>", styles["value"])]
        story.append(Table([row], colWidths=[130*mm, 40*mm]))

    doc.build(story, onFirstPage=lambda c, d: add_header_footer(c, d, clinic), onLaterPages=lambda c, d: add_header_footer(c, d, clinic))
    buf.seek(0)
    return send_file(buf, mimetype="application/pdf", as_attachment=True, download_name=f"summary_{today}.pdf")
