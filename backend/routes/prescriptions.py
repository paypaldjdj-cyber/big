from flask import Blueprint, request, jsonify, g, send_file
from database import db_required
import json, random, string, io, os
from datetime import datetime

prescriptions_bp = Blueprint("prescriptions", __name__)

def gen_rx_number():
    return "RX-" + "".join(random.choices(string.digits, k=6))

@prescriptions_bp.route("/", methods=["POST"])
@db_required
def create_prescription():
    data = request.json
    rx_number = gen_rx_number()
    date_str = datetime.now().strftime("%Y-%m-%d")
    drugs_list = data.get("drugs", [])
    drugs_json = json.dumps(drugs_list, ensure_ascii=False)
    
    meds_summary = "، ".join([d.get("name", "") for d in drugs_list])
    
    cursor = g.db.execute("""
        INSERT INTO prescriptions (patient_id, meds, notes, date, rx_number, diagnosis, drugs_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        data.get("patient_id"), meds_summary, data.get("diagnosis", ""), date_str, rx_number, data.get("diagnosis", ""), drugs_json
    ))
    g.db.commit()
    return jsonify({"id": cursor.lastrowid, "rx_number": rx_number}), 201

@prescriptions_bp.route("/<int:rid>/pdf", methods=["GET"])
@db_required
def download_pdf(rid):
    rx = g.db.execute("SELECT * FROM prescriptions WHERE id = ?", (rid,)).fetchone()
    if not rx: return jsonify({"error": "Not found"}), 404
    
    patient = g.db.execute("SELECT * FROM patients WHERE id = ?", (rx["patient_id"],)).fetchone()
    
    settings_rows = g.db.execute("SELECT key, value FROM settings").fetchall()
    clinic = {row["key"]: row["value"] for row in settings_rows}
    
    doc_name = clinic.get("doctor_name", "الدكتور")
    clinic_name = clinic.get("clinic_name", "عيادة الأسنان")
    specialty = clinic.get("specialty", "طب الأسنان")
    address = clinic.get("address", "")
    phone = clinic.get("phone", "")
    
    drugs = json.loads(rx["drugs_json"] or "[]")

    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.units import mm
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, HRFlowable, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.utils import ImageReader
        import base64
        import re

        def force_english(text):
            if not text: return ""
            text = str(text)
            if " - " in text:
                parts = text.split(" - ")
                text = max(parts, key=lambda p: len(re.findall(r'[a-zA-Z0-9]', p)))
            mapping = {
                "ملغ": "mg", "غم": "g", "أيام": "days", "يوم": "day", "ساعة": "hour", "ساعات": "hours",
                "مرة": "time", "مرات": "times", "قبل الاكل": "before food", "بعد الاكل": "after food",
                "عند اللزوم": "as needed", "كبسول": "capsule", "حبوب": "tablet", "شراب": "syrup",
                "حقنة": "injection", "يومياً": "daily"
            }
            for ar_term, en_term in mapping.items():
                text = text.replace(ar_term, en_term)
            text = re.sub(r'[\u0600-\u06FF]+', '', text)
            text = re.sub(r'\s+', ' ', text).strip()
            return text

        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
        
        font_path = r"C:\Windows\Fonts\arial.ttf"
        font_bold_path = r"C:\Windows\Fonts\arialbd.ttf"
        
        try:
            pdfmetrics.registerFont(TTFont('ArabicFont', font_path))
            pdfmetrics.registerFont(TTFont('ArabicFont-Bold', font_bold_path))
            reg_font = 'ArabicFont'
            bld_font = 'ArabicFont-Bold'
        except:
            reg_font = 'Helvetica'
            bld_font = 'Helvetica-Bold'

        buf = io.BytesIO()
        # Use zero margins for full-width header/footer
        doc = SimpleDocTemplate(
            buf, pagesize=A4,
            rightMargin=15*mm, leftMargin=15*mm,
            topMargin=0, bottomMargin=0
        )

        styles = getSampleStyleSheet()
        normal_style = ParagraphStyle(
            "normal", parent=styles["Normal"],
            fontSize=11, leading=14, fontName=reg_font, alignment=0
        )
        label_style = ParagraphStyle(
            "label", parent=normal_style,
            fontSize=10, fontName=bld_font, color=colors.grey
        )
        value_style = ParagraphStyle(
            "value", parent=normal_style,
            fontSize=11, fontName=reg_font, color=colors.black
        )

        story = []
        
        # 1. Header Image (Full Width)
        if clinic.get("prescription_header"):
            try:
                img_str = clinic["prescription_header"]
                if "," in img_str: img_str = img_str.split(",")[1]
                header_bin = base64.b64decode(img_str)
                header_img = Image(io.BytesIO(header_bin), width=A4[0], height=60*mm)
                story.append(header_img)
            except: story.append(Spacer(1, 60*mm))
        else:
            story.append(Spacer(1, 60*mm))

        story.append(Spacer(1, 10*mm))

        # 2. Patient Info Table (Premium Grid)
        p_name = force_english((patient["first_name"] + " " + patient["last_name"]) if patient else "Unknown")
        p_age = str(patient["age"]) if patient else ""
        p_gender = str(patient["gender"]) if patient else ""
        date_str = str(rx["date"])
        
        info_data = [
            [Paragraph("Patient Name", label_style), Paragraph("Age", label_style), Paragraph("Gender", label_style), Paragraph("Date", label_style)],
            [Paragraph(p_name, value_style), Paragraph(p_age, value_style), Paragraph(p_gender, value_style), Paragraph(date_str, value_style)]
        ]
        
        info_table = Table(info_data, colWidths=[70*mm, 30*mm, 30*mm, 40*mm])
        info_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.whitesmoke),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('LINEBELOW', (0, 0), (-1, 0), 1, colors.lightgrey),
        ]))
        story.append(info_table)
        
        if rx["diagnosis"]:
            story.append(Spacer(1, 6*mm))
            story.append(Paragraph(f"<b>Diagnosis:</b> {force_english(rx['diagnosis'])}", normal_style))
            
        story.append(Spacer(1, 8*mm))
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#185FA5")))
        story.append(Spacer(1, 10*mm))

        # 3. Rx Symbol
        story.append(Paragraph("<font size='36' face='ArabicFont-Bold' color='#185FA5'>Rx</font>", normal_style))
        story.append(Spacer(1, 12*mm)) # Increased from 6mm to 12mm

        # 4. Drugs List
        for d in drugs:
            name = force_english(d.get('name', ''))
            dose = force_english(d.get('dose', ''))
            timing = force_english(d.get('timing', ''))
            duration = force_english(d.get('duration', ''))
            form = force_english(d.get('form', ''))
            
            drug_line = f"<b>{name}</b>"
            details_line = f"{dose} — {timing} — for {duration} ({form})"
            
            story.append(Paragraph(drug_line, ParagraphStyle("dn", parent=normal_style, fontSize=13, fontName=bld_font, leading=18)))
            story.append(Paragraph(details_line, ParagraphStyle("dd", parent=normal_style, fontSize=11, color=colors.darkslategray, leftIndent=10)))
            
            if d.get("note"):
                story.append(Paragraph(f"<i>Note: {force_english(d.get('note', ''))}</i>", ParagraphStyle("dn", parent=normal_style, fontSize=10, color=colors.grey, leftIndent=10, topIndent=2)))
            
            story.append(Spacer(1, 8*mm))

        story.append(Spacer(1, 30*mm))

        # 5. Doctor Signature
        sig_data = [["", Paragraph("<b>Doctor's Signature</b><br/><br/>_______________________", ParagraphStyle("sig", parent=normal_style, alignment=1))]]
        sig_table = Table(sig_data, colWidths=[110*mm, 60*mm])
        story.append(sig_table)

        # Build with static footer
        def add_footer(canvas, doc):
            if clinic.get("prescription_footer"):
                try:
                    img_str = clinic["prescription_footer"]
                    if "," in img_str: img_str = img_str.split(",")[1]
                    footer_bin = base64.b64decode(img_str)
                    canvas.drawImage(ImageReader(io.BytesIO(footer_bin)), 0, 0, width=A4[0], height=45*mm)
                except: pass

        doc.build(story, onFirstPage=add_footer, onLaterPages=add_footer)
        
        buf.seek(0)
        return send_file(
            buf,
            mimetype="application/pdf",
            as_attachment=True,
            download_name=f"prescription_{rx['rx_number']}.pdf"
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
