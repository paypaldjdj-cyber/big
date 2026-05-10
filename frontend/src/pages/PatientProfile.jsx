import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getPatient, saveTeeth, addInvoice, uploadPrescription, updatePatient, addTreatment, deleteTreatment, createSmartPrescription, addAppointment, updateAppointment, getPrescriptionPDFUrl, BASE } from "../api";
import { useLanguage } from "../LanguageContext";
import { createPortal } from "react-dom";
import { useSettings } from "../SettingsContext";
// CasePresentation removed as unused
import PrescriptionModal from "../components/PrescriptionModal";
import TeethMap from "../components/TeethMap";
import TeethMap3D from "../components/TeethMap3D";
import AdvancedMap from "./AdvancedMap";

const localDate = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };

const ReportRow = ({ label, val, unit, color, bold }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
    <span style={{ fontSize: 14, color: "var(--text-muted)" }}>{label}</span>
    <span style={{ fontSize: bold ? 20 : 16, fontWeight: 700, color: color || "white" }}>
      {typeof val === 'number' ? val.toLocaleString() : val} {unit}
    </span>
  </div>
);

export default function PatientProfile() {
  const { id } = useParams();
  const nav = useNavigate();
  const { lang, t } = useLanguage();
  const { settings } = useSettings();
  const [patient, setPatient] = useState(null);
  const [tab, setTab] = useState(null);
  const [activePage, setActivePage] = useState("info"); // Default page
  const [isOngoing, setIsOngoing] = useState(true);
  const [showTimeline, setShowTimeline] = useState(false);
  const [agreedPrice, setAgreedPrice] = useState(0);
  const [payments, setPayments] = useState([]);
  const [payModal, setPayModal] = useState({ show: false, amount: "", session_cost: "", method: "Cash", notes: "" });
  const [localPhone, setLocalPhone] = useState("");
  const [viewingPrescription, setViewingPrescription] = useState(null);
  const [newTreatment, setNewTreatment] = useState({ tooth_number: "", procedure: "", notes: "", cost: "" });
  const [isAddingTreatment, setIsAddingTreatment] = useState(false);
  const [toothFilter, setToothFilter] = useState(null);
  const [timelineDate, setTimelineDate] = useState(localDate());
  const [mapMode, setMapMode] = useState("3D"); 
  const [sessionStep, setSessionStep] = useState(null); // null = not started, 0-4 = steps
  const [sessionData, setSessionData] = useState({ treatments: [], current: { tooth: "", procedure: "", cost: "", notes: "" }, meds: [], paid: "", teeth: null });
  
  // Local states for onBlur saving
  const [localAge, setLocalAge] = useState("");
  const [localOccupation, setLocalOccupation] = useState("");
  const [localAddress, setLocalAddress] = useState("");
  const [localConditions, setLocalConditions] = useState("");
  const [localNotes, setLocalNotes] = useState("");
  const [isSavingSession, setIsSavingSession] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ show: false, title: "", message: "", onConfirm: null });
  const [priceModal, setPriceModal] = useState({ show: false, val: "" });
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Reset tab when activePage changes
    setTab(null);
  }, [activePage]);

  const load = async () => {
    try {
      const data = await getPatient(id);
      setPatient(data);
      setLocalPhone(data.phone || "");
      setLocalAge(data.age || "");
      setLocalOccupation(data.occupation || "");
      setLocalAddress(data.address || "");
      setLocalConditions(data.systemic_conditions || "");
      setLocalNotes(data.notes || "");
      setIsOngoing(!!data.is_ongoing);
      setAgreedPrice(data.total_agreed_price || 0);
      if (data.invoices) {
        setPayments(data.invoices);
      }
    } catch (err) {
      console.error(err);
      nav("/patients");
    }
  };

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    const handleOpenAdd = (e) => {
      if (sessionStep !== null) return; // Don't open standalone modal during wizard
      setNewTreatment(prev => ({ ...prev, tooth_number: e.detail || "" }));
      setIsAddingTreatment(true);
    };
    window.addEventListener('openAddTreatment', handleOpenAdd);

    // Auto-start session if redirected from schedule
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'start-session' && sessionStep === null) {
      setSessionStep(0);
      // Clean up URL without refreshing
      window.history.replaceState({}, '', window.location.pathname);
    }

    return () => window.removeEventListener('openAddTreatment', handleOpenAdd);
  }, []);

  const saveProfile = async (updates) => {
    await updatePatient(id, updates);
    load();
  };

  const printPaymentStatement = () => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <html>
        <head>
          <title>Account Statement - ${patient.first_name}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap');
            body { direction: rtl; font-family: 'Cairo', sans-serif; margin: 0; padding: 40px; color: #333; }
            .header { text-align: center; border-bottom: 2px solid var(--primary); padding-bottom: 20px; margin-bottom: 30px; }
            .logo { width: 80px; height: 80px; border-radius: 15px; }
            .title { fontSize: 24px; font-weight: 800; color: #111; margin: 10px 0; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th { background: #f3f4f6; padding: 12px; text-align: right; border-bottom: 2px solid #ddd; }
            td { padding: 12px; border-bottom: 1px solid #eee; }
            .summary { margin-top: 30px; padding: 20px; background: #f9fafb; border-radius: 15px; }
            .summary-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-weight: 700; }
            .footer { text-align: center; margin-top: 50px; font-size: 12px; color: #666; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="header">
            ${settings?.clinic_logo ? `<img src="${BASE + settings.clinic_logo}" class="logo" />` : ''}
            <div class="title">${settings?.clinic_name || "SmileCare Clinic"}</div>
            <div style="font-size: 18px; color: #666;">كشف حساب مالي للمريض</div>
          </div>
          
          <div style="margin-bottom: 20px;">
            <div><strong>اسم المريض:</strong> ${patient.first_name} ${patient.last_name}</div>
            <div><strong>تاريخ التقرير:</strong> ${localDate()}</div>
          </div>

          <table>
            <thead>
              <tr>
                <th>تاريخ الدفعة</th>
                <th>المبلغ المدفوع</th>
                <th>ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              ${payments.map(p => `
                <tr>
                  <td>${p.date}</td>
                  <td style="font-weight: 700;">${(parseFloat(p.paid) || parseFloat(p.paid_amount) || 0).toLocaleString()} د.ع</td>
                  <td>${p.notes || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="summary">
            <div class="summary-row"><span>إجمالي السعر المتفق عليه:</span><span>${agreedPrice.toLocaleString()} د.ع</span></div>
            <div class="summary-row" style="color: #10b981;"><span>إجمالي المبالغ المدفوعة:</span><span>${totalPaid.toLocaleString()} د.ع</span></div>
            <div class="summary-row" style="color: #ef4444; font-size: 20px; border-top: 2px solid #ddd; padding-top: 10px; margin-top: 10px;">
              <span>المتبقي النهائي (الدين):</span><span>${remaining.toLocaleString()} د.ع</span>
            </div>
          </div>

          <div class="footer">طبع بواسطة نظام SmileCare - ${new Date().toLocaleString()}</div>
        </body>
      </html>
    `);
    doc.close();
    
    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 300);
  };

  const printReceiptIframe = (receipt) => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <html>
        <head>
          <title>Receipt - ${receipt.patient_name}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap');
            body { direction: rtl; font-family: 'Cairo', sans-serif; margin: 0; padding: 20px; color: #333; line-height: 1.6; }
            .header-img { width: 100%; max-height: 150px; object-fit: contain; margin-bottom: 20px; }
            .footer-img { width: 100%; max-height: 100px; object-fit: contain; margin-top: 20px; position: fixed; bottom: 0; left: 0; }
            .header-text { text-align: center; border-bottom: 2px solid #00d2ff; padding-bottom: 15px; margin-bottom: 25px; }
            .logo { width: 80px; height: 80px; border-radius: 15px; margin-bottom: 10px; }
            .subtitle { font-size: 18px; color: #00d2ff; font-weight: 700; margin-top: 5px; border: 1px solid #00d2ff; display: inline-block; padding: 4px 20px; borderRadius: 20px; }
            .content { padding: 0 10px; }
            .receipt-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 15px; padding: 20px; margin-bottom: 20px; }
            .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px dashed #e5e7eb; }
            .row:last-child { border-bottom: none; }
            .label { font-weight: 700; color: #666; }
            .val { font-weight: 700; color: #111; }
            .footer-text { text-align: center; margin-top: 25px; font-size: 14px; color: #555; font-weight: 500; }
            @media print {
              html, body { height: 100%; }
              .no-print { display: none !important; }
            }
          </style>
        </head>
        <body>
          ${(settings?.receipt_header || settings?.prescription_header) ? `<img src="${settings.receipt_header || settings.prescription_header}" class="header-img" />` : `
            <div class="header-text">
              ${settings?.clinic_logo ? `<img src="${BASE + settings.clinic_logo}" class="logo" />` : ''}
              <h2>${settings?.clinic_name || "SmileCare Clinic"}</h2>
              <div class="subtitle">وصل استلام مالي (Receipt)</div>
            </div>
          `}
          <div class="content">
            ${(settings?.receipt_header || settings?.prescription_header) ? '<div style="text-align: center; margin-bottom: 10px;"><div class="subtitle">وصل استلام مالي (Receipt)</div></div>' : ''}
            <div class="receipt-box">
              <div class="row"><span class="label">التاريخ:</span><span class="val">${receipt.date}</span></div>
              <div class="row"><span class="label">اسم المريض:</span><span class="val">${receipt.patient_name}</span></div>
              <div class="row"><span class="label">السعر الكلي للعلاج:</span><span class="val">${(receipt.total_price || 0).toLocaleString()} د.ع</span></div>
              <div class="row"><span class="label">الدين الكلي المتبقي (قبل):</span><span class="val">${(receipt.total_debt !== undefined ? receipt.total_debt : ((receipt.patient_debt || 0) + (receipt.paid || 0))).toLocaleString()} د.ع</span></div>
              <div class="row"><span class="label">الدفعة الجديدة:</span><span class="val" style="font-size: 20px; color: #10b981;">${(receipt.paid || 0).toLocaleString()} د.ع</span></div>
              <div class="row"><span class="label" style="color: #ef4444;">الدين الكلي المتبقي الجديد:</span><span class="val" style="color: #ef4444;">${(receipt.patient_debt || 0).toLocaleString()} د.ع</span></div>
            </div>
            <div class="footer-text">شكراً لزيارتكم ونتمنى لكم دوام الصحة والعافية ✨</div>
          </div>
          ${(settings?.receipt_footer || settings?.prescription_footer) ? `<img src="${settings.receipt_footer || settings.prescription_footer}" class="footer-img" />` : ''}
        </body>
      </html>
    `);
    doc.close();
    
    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 300);
  };

  const addPayment = async () => {
    if (!payModal.amount) return;
    
    const paidAmt = parseFloat(payModal.amount);
    
    // 500 IQD validation
    if (paidAmt % 500 !== 0) {
      return alert(t("⚠️ عذراً، يجب أن يكون المبلغ المدفوع من مضاعفات الـ 500 دينار عراقي."));
    }

    const isSessions = patient?.payment_system === 'sessions';
    let sessionCost = 0;

    if (isSessions) {
      sessionCost = parseFloat(payModal.session_cost) || 0;
      if (sessionCost > 0 && sessionCost % 500 !== 0) {
        return alert(t("⚠️ عذراً، يجب أن تكون تكلفة الجلسة من مضاعفات الـ 500 دينار عراقي."));
      }
      
      const previousDebt = totalSessionCosts - totalPaid;
      if (paidAmt > previousDebt + sessionCost) {
        return alert(t("لا يمكن إدخال مبلغ يتجاوز قيمة الدين المتبقي زائد تكلفة الجلسة."));
      }
    } else {
      if (paidAmt > remaining) {
        return alert(t("لا يمكن إدخال مبلغ يتجاوز قيمة الدين المتبقي."));
      }
    }

    await addInvoice({ 
      patient_id: parseInt(id), 
      total_amount: isSessions ? sessionCost : 0, 
      paid_amount: paidAmt,
      payment_method: payModal.method,
      notes: payModal.notes,
      date: localDate()
    });

    // Print receipt after adding
    printReceiptIframe({
      date: localDate(),
      patient_name: patient.first_name + " " + patient.last_name,
      total_price: isSessions ? totalSessionCosts + sessionCost : agreedPrice,
      paid: paidAmt,
      patient_debt: remaining - (isSessions ? 0 : paidAmt) // This is a bit tricky, load() will update the real remaining
    });

    setPayModal({ show: false, amount: "", session_cost: "", method: "Cash", notes: "" });
    load();
  };

  if (!patient) return <div style={{ color: "white", padding: 40 }}>{t("جاري التحميل...")}</div>;

  const totalPaid = payments.reduce((acc, curr) => acc + (parseFloat(curr.paid) || parseFloat(curr.paid_amount) || 0), 0);
  const totalSessionCosts = payments.reduce((acc, curr) => acc + (parseFloat(curr.amount) || parseFloat(curr.total_amount) || 0), 0);
  const isSessions = patient?.payment_system === 'sessions';
  const remaining = isSessions ? (totalSessionCosts - totalPaid) : ((parseFloat(agreedPrice) || 0) - totalPaid);

  return (
    <div className="animate-fade" style={{ padding: isMobile ? 0 : 20 }}>
      <style>{`
        .profile-layout { display: grid; grid-template-columns: 1fr 340px; gap: 32px; }
        .form-section { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; }
        .finance-summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-bottom: 32px; }
        .grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 32px; }
        .full-width { grid-column: span 2; }
        .action-card { 
          background: rgba(255, 255, 255, 0.03); 
          border: 1px solid rgba(255, 255, 255, 0.08); 
          border-radius: 20px; 
          padding: 20px; 
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 16px;
        }
        .action-card:hover { 
          background: rgba(255, 255, 255, 0.08); 
          border-color: var(--primary);
          transform: translateY(-4px);
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2);
        }
        .input-group { display: flex; flex-direction: column; gap: 10px; }
        .input-label { font-size: 13px; color: var(--text-muted); padding-right: 4px; font-weight: 600; }
        
        .contact-pill {
          display: flex;
          gap: 12px;
          background: rgba(255,255,255,0.03);
          padding: 6px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.08);
          align-items: center;
        }
        .icon-btn {
          width: 38px;
          height: 38px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          transition: all 0.2s;
          font-size: 18px;
        }
        .icon-btn.wa { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
        .icon-btn.tel { background: rgba(234, 179, 8, 0.15); color: #eab308; }
        .icon-btn:hover { transform: scale(1.08); filter: brightness(1.2); }

        @media (max-width: 1200px) {
          .profile-layout { grid-template-columns: 1fr 280px; gap: 24px; }
        }
        @media (max-width: 992px) {
          .profile-layout { grid-template-columns: 1fr; }
          .finance-summary-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 768px) {
          .form-section { grid-template-columns: 1fr; gap: 20px; }
          .finance-summary-grid { grid-template-columns: 1fr; }
          .grid-2 { grid-template-columns: 1fr; gap: 24px; }
          .full-width { grid-column: span 1; }
        }
      `}</style>
      
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <div style={{ 
          background: isOngoing ? "#10b981" : "#64748b", 
          padding: isMobile ? "6px 16px" : "8px 24px", 
          borderRadius: 30, display: "flex", alignItems: "center", gap: 10, cursor: "pointer" 
        }} onClick={() => {
          const next = !isOngoing;
          setIsOngoing(next);
          saveProfile({ is_ongoing: next ? 1 : 0 });
        }}>
          <span style={{ fontWeight: 700, color: "white", fontSize: isMobile ? 12 : 14 }}>{isOngoing ? t("Ongoing Case") : t("Closed Case")}</span>
          <div style={{ width: isMobile ? 18 : 24, height: isMobile ? 18 : 24, borderRadius: "50%", background: "white" }} />
        </div>
      </div>

      <div style={{ 
        display: "flex", gap: 8, marginBottom: 24, padding: 4, 
        background: "rgba(255,255,255,0.03)", borderRadius: 16,
        overflowX: "auto", whiteSpace: "nowrap"
      }}>
        {[
          { id: "info", label: t("بيانات المريض والمالية"), icon: "👤" },
          { id: "treatment", label: t("العلاجات والوصفات"), icon: "📋" },
          { id: "teeth", label: t("خريطة الأسنان"), icon: "🦷" },
          { id: "appointments", label: t("المواعيد"), icon: "📅" }
        ].map(p => (
          <button 
            key={p.id}
            onClick={() => setActivePage(p.id)}
            style={{
              flex: 1, padding: "12px 20px", borderRadius: 12, border: "none",
              background: activePage === p.id ? "var(--primary)" : "transparent",
              color: activePage === p.id ? "white" : "var(--text-muted)",
              cursor: "pointer", transition: "all 0.3s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              fontWeight: 600, fontSize: 14
            }}
          >
            <span>{p.icon}</span>
            <span>{p.label}</span>
          </button>
        ))}
      </div>

      {activePage === "info" && (
        <div className="animate-fade">
          <div className="profile-layout">
            <div className="glass-panel" style={{ padding: 24 }}>
              <div className="form-section">
                <div className="input-group">
                  <label className="input-label">{t("الاسم الكامل")}</label>
                  <input className="glass-input" value={patient.first_name + " " + patient.last_name} readOnly style={{ textAlign: lang==="ar"?"right":"left" }} />
                </div>
                <div className="input-group">
                  <label className="input-label">{t("رقم الهاتف")}</label>
                  <div className="contact-pill">
                    <input className="glass-input" style={{ flex: 1, border: "none", background: "transparent" }} value={localPhone} onChange={e => setLocalPhone(e.target.value)} onBlur={() => localPhone !== patient.phone && saveProfile({ phone: localPhone })} />
                    <a href="#" className="icon-btn wa" onClick={(e) => {
                      e.preventDefault();
                      const clean = localPhone.replace(/\D/g, '');
                      const finalPhone = clean.startsWith('0') ? '964' + clean.substring(1) : clean.startsWith('964') ? clean : '964' + clean;
                      const msg = (settings.whatsapp_template_followup || "أهلاً {patient}، نود الاطمئنان عليك").replace(/{patient}/g, patient.first_name);
                      if (!finalPhone || finalPhone === '964') return alert(t("رقم غير صحيح"));
                      window.open(`https://api.whatsapp.com/send?phone=${finalPhone}&text=${encodeURIComponent(msg)}`, '_blank');
                    }}>💬</a>
                    <a href={`tel:${localPhone}`} className="icon-btn tel">📞</a>
                  </div>
                </div>
                <div className="input-group">
                  <label className="input-label">{t("العمر")}</label>
                  <input className="glass-input" type="number" value={localAge} onChange={e => setLocalAge(e.target.value)} onBlur={() => localAge !== patient.age && saveProfile({ age: localAge })} />
                </div>
                <div className="input-group">
                  <label className="input-label">{t("الجنس")}</label>
                  <div style={{ display: "flex", gap: 16, height: 44, alignItems: "center", background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "0 16px" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                      <input type="radio" checked={patient.gender === "Male"} onChange={() => saveProfile({ gender: "Male" })} /> {t("ذكر")}
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                      <input type="radio" checked={patient.gender === "Female"} onChange={() => saveProfile({ gender: "Female" })} /> {t("أنثى")}
                    </label>
                  </div>
                </div>
                <div className="input-group full-width">
                  <label className="input-label">{t("أمراض مزمنة")}</label>
                  <textarea className="glass-input" style={{ minHeight: 80, padding: 12 }} value={localConditions} onChange={e => setLocalConditions(e.target.value)} onBlur={() => localConditions !== patient.systemic_conditions && saveProfile({ systemic_conditions: localConditions })} />
                </div>
                <div className="input-group full-width">
                  <label className="input-label">{t("ملاحظات")}</label>
                  <textarea className="glass-input" style={{ minHeight: 80, padding: 12 }} value={localNotes} onChange={e => setLocalNotes(e.target.value)} onBlur={() => localNotes !== patient.notes && saveProfile({ notes: localNotes })} />
                </div>
              </div>
            </div>
            <div className="glass-panel" style={{ padding: 20 }}>
              <label className="input-label" style={{ marginBottom: 10, display: "block" }}>{t("نوع الحالة")}</label>
              <select className="glass-input" style={{ width: "100%", height: 44, marginBottom: 16 }} value={patient.case_category || ""} onChange={e => saveProfile({ case_category: e.target.value })}>
                <option value="">{t("اختر...")}</option>
                {["Filling", "Endodontic", "Extraction", "Surgery", "Implant", "Prosthetic", "Orthodontic", "Other"].map(c => <option key={c} value={c}>{t(c)}</option>)}
              </select>

              <div className="action-card" onClick={() => setShowTimeline(true)} style={{ background: "rgba(0, 210, 255, 0.1)", borderColor: "rgba(0, 210, 255, 0.3)", marginBottom: 12 }}>
                <div style={{ fontSize: 24 }}>⏳</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "var(--primary)" }}>{t("السجل الزمني المتكامل")}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{t("عرض تطور الحالة حسب الجلسات")}</div>
                </div>
              </div>

              <button className="btn-primary" onClick={() => {
                setSessionData({ treatments: [], current: { tooth: "", procedure: "", cost: "", notes: "" }, meds: [], paid: "", teeth: patient.teeth });
                setSessionStep(0);
              }} style={{ width: "100%", height: 50, borderRadius: 12, fontSize: 15, fontWeight: 800, background: "linear-gradient(135deg, #10b981, #059669)", boxShadow: "0 8px 16px rgba(16, 185, 129, 0.2)", border: "none" }}>
                🚀 {t("بدء جلسة العلاج")}
              </button>
            </div>
          </div>

          <div style={{ marginTop: 40, borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 40 }}>
            <div className="finance-summary-grid">
              <div className="glass-panel" style={{ padding: 16, textAlign: "center", borderLeft: "4px solid var(--primary)" }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{isSessions ? t("تكلفة الجلسات") : t("السعر الكلي")}</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{(isSessions ? totalSessionCosts : agreedPrice).toLocaleString()} {t("د")}</div>
                {!isSessions && <button className="btn-ghost" style={{ fontSize: 10, marginTop: 10 }} onClick={() => setPriceModal({ show: true, val: agreedPrice })}>{t("تعديل")}</button>}
              </div>
              <div className="glass-panel" style={{ padding: 16, textAlign: "center", borderLeft: "4px solid #10b981" }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{t("المدفوع")}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#10b981" }}>{(totalPaid || 0).toLocaleString()} {t("د")}</div>
              </div>
              <div className="glass-panel" style={{ padding: 16, textAlign: "center", borderLeft: "4px solid #ef4444" }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{t("المتبقي")}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#ef4444" }}>{(remaining || 0).toLocaleString()} {t("د")}</div>
              </div>
            </div>
            <div className="glass-panel" style={{ padding: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
                <h3 style={{ fontSize: 18 }}>{t("سجل الدفعات")}</h3>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn-secondary" onClick={printPaymentStatement} style={{ padding: "8px 16px" }}>🖨 {t("طباعة كشف الحساب")}</button>
                  <button className="btn-primary" onClick={() => setPayModal({ show: true, amount: remaining > 0 ? remaining : "", session_cost: "", method: "Cash", notes: "" })}>{t("+ إضافة")}</button>
                </div>
              </div>
              <table style={{ width: "100%" }}>
                <thead>
                  <tr style={{ textAlign: lang === "ar" ? "right" : "left", fontSize: 12, color: "var(--text-muted)" }}>
                    <th style={{ padding: 10 }}>{t("التاريخ")}</th>
                    <th style={{ padding: 10 }}>{t("المبلغ")}</th>
                    <th style={{ padding: 10 }}>{t("ملاحظات")}</th>
                    <th style={{ padding: 10 }}>{t("إجراء")}</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                      <td style={{ padding: 10 }}>{p.date}</td>
                      <td style={{ padding: 10, fontWeight: 700, color: (parseFloat(p.paid) || 0) > 0 ? "#10b981" : "white" }}>
                        {(parseFloat(p.paid) || parseFloat(p.paid_amount) || 0).toLocaleString()} د
                      </td>
                      <td style={{ padding: 10, color: "var(--text-muted)", fontSize: 13 }}>{p.notes}</td>
                      <td style={{ padding: 10 }}>
                        <button 
                          onClick={() => printReceiptIframe({
                            date: p.date,
                            patient_name: patient.first_name + " " + patient.last_name,
                            total_price: isSessions ? totalSessionCosts : agreedPrice,
                            paid: (parseFloat(p.paid) || parseFloat(p.paid_amount) || 0),
                            patient_debt: p.patient_debt || 0,
                            total_debt: (p.patient_debt || 0) + (parseFloat(p.paid) || parseFloat(p.paid_amount) || 0)
                          })}
                          className="btn-ghost" style={{ padding: "4px 8px" }} title={t("طباعة وصل")}>🖨</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activePage === "treatment" && (
        <div className="animate-fade" style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.5fr 1fr", gap: 24 }}>
          <div className="glass-panel" style={{ padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <h3 style={{ fontSize: 18 }}>📋 {t("العلاجات")}</h3>
              <button className="btn-primary" onClick={() => setIsAddingTreatment(true)}>{t("+ إضافة")}</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {(patient.treatments || []).map((tr, i) => (
                <div key={i} style={{ padding: 16, background: "rgba(255,255,255,0.03)", borderRadius: 12, borderLeft: "4px solid var(--primary)", display: "flex", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{tr.date} - <span style={{ color: "var(--primary)" }}>#{tr.tooth_number}</span></div>
                    <div style={{ fontSize: 15, marginTop: 4 }}>{tr.procedure}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{tr.notes}</div>
                  </div>
                  <button onClick={() => setConfirmModal({ show: true, title: t("حذف العلاج"), message: t("هل أنت متأكد من حذف هذا الإجراء؟"), onConfirm: () => deleteTreatment(tr.id).then(load) })} className="btn-ghost" style={{ color: "#ef4444" }}>✕</button>
                </div>
              ))}
            </div>
          </div>
          <div className="glass-panel" style={{ padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <h3 style={{ fontSize: 18 }}>💊 {t("الوصفات")}</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-ghost" onClick={() => setTab("smart-prescription")}>📝</button>
                <button className="btn-ghost" onClick={() => setTab("prescriptions")}>📸</button>
              </div>
            </div>
            {(patient.prescriptions || []).map(pr => (
              <div key={pr.id} className="action-card" onClick={() => setViewingPrescription(pr)} style={{ margin: "0 0 10px 0", padding: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{pr.date}</div>
                  <div style={{ fontSize: 14 }}>{pr.meds || t("وصفة مصورة")}</div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); window.open(getPrescriptionPDFUrl(pr.id), "_blank"); }} className="btn-ghost">🖨</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activePage === "teeth" && (
        <div className="animate-fade">
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            <div style={{ background: "rgba(255,255,255,0.05)", padding: 6, borderRadius: 16, display: "flex", gap: 8 }}>
              <button onClick={() => setMapMode("2D")} style={{ padding: "8px 24px", borderRadius: 12, border: "none", background: mapMode === "2D" ? "var(--primary)" : "transparent", color: mapMode === "2D" ? "white" : "var(--text-muted)", fontWeight: 700, cursor: "pointer", transition: "0.3s" }}>2D View</button>
              <button onClick={() => setMapMode("3D")} style={{ padding: "8px 24px", borderRadius: 12, border: "none", background: mapMode === "3D" ? "var(--primary)" : "transparent", color: mapMode === "3D" ? "white" : "var(--text-muted)", fontWeight: 700, cursor: "pointer", transition: "0.3s" }}>3D View ✨</button>
            </div>
          </div>
          <div className="glass-panel" style={{ padding: 24 }}>
            {mapMode === "2D" ? (
              <TeethMap pid={id} initial={patient.teeth} treatments={patient.treatments || []} 
                onToothClick={(tid) => { 
                  // Just select it to show history, don't force open the modal!
                }} 
                onAddTreatment={(tid) => {
                  setNewTreatment(prev => ({ ...prev, tooth_number: tid || "" }));
                  setIsAddingTreatment(true);
                }}
              />
            ) : (
              <TeethMap3D 
                pid={id} 
                data={patient.teeth} 
                treatments={patient.treatments || []}
                onChange={(newData) => saveTeeth(id, newData).then(load)}
                onToothClick={(tid) => {
                  setNewTreatment(prev => ({ ...prev, tooth_number: tid || "" }));
                  setIsAddingTreatment(true);
                }}
              />
            )}
          </div>
        </div>
      )}

      {activePage === "appointments" && (
        <div className="animate-fade">
          <div className="glass-panel" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 18, marginBottom: 20 }}>📅 {t("المواعيد")}</h3>
            {(patient.visits || []).map(v => (
              <div key={v.id} style={{ padding: 16, background: "rgba(255,255,255,0.03)", borderRadius: 12, marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 600 }}>{v.date} · {v.time}</span>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, background: "rgba(0,210,255,0.1)", color: "var(--primary)" }}>{v.status}</span>
                </div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>{v.type} ({v.duration_min} {t("دقيقة")})</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals and Common Elements */}
      {isAddingTreatment && (
        <Modal title={t("إضافة إجراء")} onClose={() => setIsAddingTreatment(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <input className="glass-input" placeholder={t("رقم السن")} value={newTreatment.tooth_number} onChange={e => setNewTreatment({...newTreatment, tooth_number: e.target.value})} />
            <input className="glass-input" placeholder={t("الإجراء")} value={newTreatment.procedure} onChange={e => setNewTreatment({...newTreatment, procedure: e.target.value})} />
            <textarea className="glass-input" placeholder={t("ملاحظات")} value={newTreatment.notes} onChange={e => setNewTreatment({...newTreatment, notes: e.target.value})} />
            <button className="btn-primary" onClick={() => addTreatment(id, { ...newTreatment, cost: 0 }).then(() => { setIsAddingTreatment(false); load(); })}>{t("حفظ")}</button>
          </div>
        </Modal>
      )}

      {tab === "smart-prescription" && <Modal title={t("وصفة ذكية")} onClose={() => setTab(null)}><PrescriptionModal patient={patient} onClose={() => setTab(null)} onRefresh={load} /></Modal>}
      {tab === "prescriptions" && (
        <Modal title={t("رفع وصفة")} onClose={() => setTab(null)}>
          <input type="file" onChange={async (e) => { const fd = new FormData(); fd.append("image", e.target.files[0]); fd.append("date", localDate()); await uploadPrescription(id, fd); load(); setTab(null); }} />
        </Modal>
      )}
      {viewingPrescription && <Modal title={t("عرض")} onClose={() => setViewingPrescription(null)}><PrescriptionModal patient={patient} onClose={() => setViewingPrescription(null)} onRefresh={load} existingData={viewingPrescription} /></Modal>}
      {payModal.show && (
        <Modal title={t("إضافة دفعة")} onClose={() => setPayModal({...payModal, show: false})}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {isSessions && <input type="number" className="glass-input" placeholder={t("تكلفة الجلسة")} value={payModal.session_cost} onChange={e => setPayModal({...payModal, session_cost: e.target.value})} />}
            <input type="number" className="glass-input" placeholder={t("المبلغ")} value={payModal.amount} onChange={e => setPayModal({...payModal, amount: e.target.value})} />
            <select className="glass-input" value={payModal.method} onChange={e => setPayModal({...payModal, method: e.target.value})}><option value="Cash">Cash</option><option value="Bank">Bank</option></select>
            <input className="glass-input" placeholder={t("ملاحظات")} value={payModal.notes} onChange={e => setPayModal({...payModal, notes: e.target.value})} />
            <button className="btn-primary" onClick={addPayment}>{t("حفظ")}</button>
          </div>
        </Modal>
      )}
      {showTimeline && (
        <Modal title={t("السجل الطبي الزمني")} onClose={() => setShowTimeline(false)} width={1100}>
          <ClinicalTimeline patient={patient} treatments={patient.treatments || []} prescriptions={patient.prescriptions || []} visits={patient.visits || []} pid={id} />
        </Modal>
      )}

      {confirmModal.show && (
        <Modal title={confirmModal.title} onClose={() => setConfirmModal({ ...confirmModal, show: false })}>
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <p style={{ marginBottom: 30, fontSize: 16 }}>{confirmModal.message}</p>
            <div style={{ display: "flex", gap: 12 }}>
              <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setConfirmModal({ ...confirmModal, show: false })}>{t("إلغاء")}</button>
              <button className="btn-primary" style={{ flex: 1, background: "#ef4444" }} onClick={() => { confirmModal.onConfirm(); setConfirmModal({ ...confirmModal, show: false }); }}>{t("تأكيد الحذف")}</button>
            </div>
          </div>
        </Modal>
      )}

      {priceModal.show && (
        <Modal title={t("تعديل السعر الكلي")} onClose={() => setPriceModal({ ...priceModal, show: false })}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <label className="input-label">{t("السعر الجديد المتفق عليه")}:</label>
            <input className="glass-input" type="number" value={priceModal.val} onChange={e => setPriceModal({ ...priceModal, val: e.target.value })} />
            <button className="btn-primary" onClick={() => { saveProfile({ total_agreed_price: parseFloat(priceModal.val) }); setPriceModal({ ...priceModal, show: false }); }}>{t("حفظ التغيير")}</button>
          </div>
        </Modal>
      )}
      {sessionStep !== null && (
        <Modal title={t("جلسة علاج جديدة")} onClose={() => setSessionStep(null)} width={900}>
          <div style={{ minHeight: 500, display: "flex", flexDirection: "column" }}>
            {/* Wizard Progress Bar */}
            <div style={{ display: "flex", gap: 10, marginBottom: 30 }}>
               {[t("البداية"), t("التشخيص"), t("الإجراء"), t("الوصفة"), t("الملخص")].map((label, i) => (
                 <div key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: sessionStep >= i ? "var(--primary)" : "rgba(255,255,255,0.05)", transition: "0.3s" }} />
               ))}
            </div>

            <div style={{ flex: 1 }}>
                {sessionStep === 0 && (
                  <div className="animate-fade" style={{ textAlign: "center", padding: "40px 0" }}>
                    <div style={{ fontSize: 60, marginBottom: 20 }}>🩺</div>
                    <h2>{t("بدء جلسة جديدة للمريض")}</h2>
                    <p style={{ color: "var(--text-muted)" }}>{patient.first_name} {patient.last_name}</p>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "var(--primary)", marginTop: 20 }}>📅 {localDate()} · {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    
                    <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 40 }}>
                      <button className="btn-primary" style={{ padding: "12px 30px" }} onClick={() => {
                          setSessionData({...sessionData, teeth: patient.teeth || {}});
                          setSessionStep(1);
                      }}>{t("جلسة جديدة")} →</button>
                      
                      {patient.treatments?.length > 0 && (
                        <button className="btn-ghost" 
                          style={{ padding: "12px 30px", borderColor: "var(--primary)", background: "rgba(24, 95, 165, 0.1)" }} 
                          onClick={() => {
                            const last = [...patient.treatments].sort((a,b) => (b.id || 0) - (a.id || 0))[0];
                            const fixedId = String(last.tooth_number);
                            setSessionData({
                              ...sessionData,
                              teeth: patient.teeth || {},
                              current: { ...sessionData.current, tooth: fixedId }
                            });
                            setSessionStep(1); // Goes to map, which now auto-selects by ID
                          }}>
                          🔄 {t("إكمال العمل")} (#{patient.treatments[patient.treatments.length - 1].tooth_number})
                        </button>
                      )}
                    </div>
                  </div>
                )}

               {sessionStep === 1 && (
                 <div className="animate-fade">
                   <h3 style={{ marginBottom: 20 }}>🦷 {t("خطوة 2: حدد السن المطلوب علاجه")}</h3>
                    {sessionData.treatments.length > 0 && (
                      <div style={{ marginBottom: 15, padding: 12, background: "rgba(16, 185, 129, 0.1)", borderRadius: 12, border: "1px solid rgba(16, 185, 129, 0.2)" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--success)" }}>✅ {t("تمت إضافة")}: </span>
                        {sessionData.treatments.map((tr, i) => <span key={i} style={{ fontSize: 13, background: "var(--primary)", padding: "2px 8px", borderRadius: 8, marginLeft: 5 }}>#{tr.tooth}</span>)}
                      </div>
                    )}
                    <TeethMap3D 
                      pid={id} 
                      data={sessionData.teeth} 
                      onChange={(newData) => setSessionData({...sessionData, teeth: newData})}
                      treatments={patient.treatments || []} 
                      focusedTooth={sessionData.current.tooth}
                      onToothClick={(tid) => {
                        if (tid !== "Manual") {
                          setSessionData({...sessionData, current: { ...sessionData.current, tooth: tid }});
                          setSessionStep(2);
                        }
                      }} 
                    />
                   <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
                     <button className="btn-ghost" onClick={() => setSessionStep(0)}>← {t("السابق")}</button>
                     {sessionData.treatments.length > 0 ? (
                        <button className="btn-primary" onClick={() => setSessionStep(3)}>{t("التالي: الوصفة الطبية")} →</button>
                      ) : (
                        <button className="btn-ghost" onClick={() => {
                          setSessionData({...sessionData, current: { ...sessionData.current, tooth: "General" }});
                          setSessionStep(2);
                        }}>{t("إجراء عام (كافة الأسنان)")} →</button>
                      )}
                   </div>
                 </div>
               )}

               {sessionStep === 2 && (
                 <div className="animate-fade" style={{ maxWidth: 500, margin: "0 auto" }}>
                   <h3 style={{ marginBottom: 20 }}>📋 {t("خطوة 3: تفاصيل الإجراء")} ({sessionData.current.tooth === "General" ? t("إجراء عام") : `#${sessionData.current.tooth}`})</h3>
                   <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      <input className="glass-input" placeholder={t("الإجراء (مثلاً: حشوة جذر)")} value={sessionData.current.procedure} onChange={e => setSessionData({...sessionData, current: { ...sessionData.current, procedure: e.target.value }})} />
                      
                      {/* Previous History for this tooth */}
                      {sessionData.current.tooth && sessionData.current.tooth !== "General" && patient.treatments?.some(tr => String(tr.tooth_number) === String(sessionData.current.tooth)) && (
                        <div style={{ background: "rgba(245, 158, 11, 0.05)", padding: 12, borderRadius: 12, border: "1px solid rgba(245, 158, 11, 0.2)", fontSize: 11 }}>
                          <div style={{ color: "#f59e0b", fontWeight: 800, marginBottom: 6, fontSize: 10 }}>🕒 {t("تاريخ العمل على هذا السن")}:</div>
                          {patient.treatments.filter(tr => String(tr.tooth_number) === String(sessionData.current.tooth)).slice(-2).reverse().map((tr, i) => (
                            <div key={i} style={{ marginBottom: 4, opacity: 0.8 }}>
                              • {tr.date}: <strong>{tr.procedure}</strong>
                            </div>
                          ))}
                        </div>
                      )}
                      <textarea className="glass-input" placeholder={t("ملاحظات طبية")} style={{ minHeight: 120 }} value={sessionData.current.notes} onChange={e => setSessionData({...sessionData, current: { ...sessionData.current, notes: e.target.value }})} />
                      
                      <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
                        <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setSessionStep(1)}>← {t("رجوع للخريطة")}</button>
                        <button className="btn-ghost" style={{ flex: 1, borderColor: "var(--primary)" }} onClick={() => {
                            if (!sessionData.current.procedure) return alert(t("يرجى إدخال الإجراء أولاً"));
                            const fixedToothId = sessionData.current.tooth ? String(sessionData.current.tooth) : "General";
                            setSessionData({
                              ...sessionData,
                              treatments: [...sessionData.treatments, { ...sessionData.current, tooth: fixedToothId }],
                              current: { tooth: "", procedure: "", notes: "" }
                            });
                            setSessionStep(1);
                         }}>➕ {t("حفظ وإضافة سن آخر")}</button>
                      </div>
                      
                      <button className="btn-primary" style={{ width: "100%", marginTop: 10 }} onClick={() => {
                          if (!sessionData.current.procedure && sessionData.treatments.length === 0) return alert(t("يرجى إدخال إجراء واحد على الأقل"));
                          let finalTreatments = [...sessionData.treatments];
                          if (sessionData.current.procedure) {
                            // Ensure tooth ID is normalized and fixed
                            const fixedToothId = sessionData.current.tooth ? String(sessionData.current.tooth) : "General";
                            finalTreatments.push({ ...sessionData.current, tooth: fixedToothId });
                          }
                          setSessionData({...sessionData, treatments: finalTreatments, current: { tooth: "", procedure: "", notes: "" }});
                          setSessionStep(3);
                      }}>{t("حفظ والذهاب للوصفة")} →</button>
                   </div>
                 </div>
               )}

               {sessionStep === 3 && (
                 <div className="animate-fade">
                   <h3 style={{ marginBottom: 20 }}>💊 {t("خطوة 4: كتابة الوصفة (اختياري)")}</h3>
                   <PrescriptionModal 
                      patient={patient} 
                      onClose={() => setSessionStep(4)} 
                      onAdd={(meds) => setSessionData(prev => ({...prev, meds}))}
                      initialMeds={sessionData.meds}
                      initialDiagnosis={sessionData.treatments.map(t => t.procedure).join(", ")}
                      isWizard
                   />
                   <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 20 }}>
                     <button className="btn-secondary" style={{ padding: "12px 30px" }} onClick={() => setSessionStep(2)}>← {t("السابق")}</button>
                     <button className="btn-primary" style={{ padding: "12px 40px" }} onClick={() => setSessionStep(4)}>{t("التالي: الملخص النهائي")} →</button>
                   </div>
                 </div>
               )}

               {sessionStep === 4 && (
                 <div className="animate-fade" id="printable-session-summary">
                   <h3 style={{ textAlign: "center", color: "var(--success)" }}>✅ {t("ملخص الجلسة")}</h3>
                   <div className="glass-panel" style={{ padding: 24, marginTop: 20, border: "2px solid rgba(16, 185, 129, 0.3)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20, alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          {settings?.clinic_logo && <img src={BASE + settings.clinic_logo} alt="Logo" style={{ width: 50, height: 50, borderRadius: 12, objectFit: "cover" }} />}
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 20, color: "black" }}>{settings?.clinic_name || "SmileCare Clinic"}</div>
                            {settings?.doctor_name && <div style={{ fontSize: 13, color: "#666" }}>{settings.doctor_name}</div>}
                          </div>
                        </div>
                        <span style={{ fontWeight: 600, color: "black" }}>{localDate()}</span>
                      </div>
                      <ReportRow label={t("المريض")} val={patient.first_name + " " + patient.last_name} unit="" />
                       <div style={{ margin: "15px 0", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 15 }}>
                         <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14 }}>📋 {t("الإجراءات المنفذة")}:</div>
                         {sessionData.treatments.map((tr, i) => (
                           <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6, background: "rgba(255,255,255,0.02)", padding: "8px 12px", borderRadius: 8 }}>
                             <span>{tr.tooth === "General" ? `🌐 ${t("إجراء عام")}` : `🦷 ${t("السن")} #${tr.tooth}`} - {tr.procedure}</span>
                           </div>
                         ))}
                       </div>
                       
                       <div className="summary-3d-container" style={{ margin: "10px auto", width: 200, height: 200, position: "relative", overflow: "hidden", background: "white", borderRadius: 16 }}>
                         <TeethMap3D 
                            pid={id} 
                            data={sessionData.teeth} 
                            onChange={() => {}} 
                            treatments={sessionData.treatments} 
                            noControls={true}
                         />
                       </div>

                       <style>{`
                         @media print {
                           body { background: white !important; -webkit-print-color-adjust: exact; }
                           body * { visibility: hidden; }
                           #printable-session-summary, #printable-session-summary * { visibility: visible; }
                           #printable-session-summary { 
                             position: fixed; 
                             left: 0; 
                             top: 0; 
                             width: 100%; 
                             background: white !important; 
                             color: black !important;
                             padding: 0 !important;
                             margin: 0 !important;
                           }
                           .summary-3d-container { 
                             width: 220px !important; 
                             height: 220px !important; 
                             border: 1px solid #ddd !important; 
                             background: white !important; 
                             margin: 20px auto !important; 
                             border-radius: 10px !important; 
                           }
                           .no-print { display: none !important; visibility: hidden !important; }
                         }
                       `}</style>

                      <div style={{ marginTop: 20 }}>
                        <div style={{ fontWeight: 700, marginBottom: 8 }}>💊 {t("الأدوية الموصوفة")}:</div>
                        {sessionData.meds?.length > 0 ? sessionData.meds.map((m, i) => <div key={i} style={{ fontSize: 13 }}>• {m.name} ({m.dose})</div>) : t("لا توجد أدوية")}
                      </div>
                   </div>
                   <div style={{ display: "flex", gap: 12, marginTop: 30 }} className="no-print">
                      <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setSessionStep(3)}>← {t("السابق")}</button>
                      <button className="btn-ghost" style={{ flex: 1 }} onClick={() => window.print()}>🖨 {t("طباعة الملخص")}</button>
                      <button className="btn-primary" disabled={isSavingSession} style={{ flex: 2, position: "relative" }} onClick={async () => {
                          setIsSavingSession(true);
                          try {
                            if (sessionData.teeth) await saveTeeth(id, sessionData.teeth);
                            for (const tr of sessionData.treatments) {
                              await addTreatment(id, { 
                                tooth_number: tr.tooth, 
                                procedure: tr.procedure, 
                                cost: parseFloat(tr.cost || 0),
                                notes: tr.notes,
                                date: localDate()
                              });
                            }
                            const today = localDate();
                            const todayApt = patient.visits?.find(v => v.date === today);
                            const teethSnapshot = JSON.stringify(sessionData.teeth);
                            if (todayApt) {
                              await updateAppointment(todayApt.id, { status: 'finished', teeth_snapshot: teethSnapshot });
                            } else {
                              await addAppointment({
                                patient_id: id, date: today,
                                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
                                type: t("جلسة علاج"), status: 'finished', teeth_snapshot: teethSnapshot
                              });
                            }
                            if (sessionData.paid) {
                               await addInvoice({
                                 patient_id: parseInt(id), total_amount: 0,
                                 paid_amount: parseFloat(sessionData.paid), payment_method: "Cash",
                                 date: localDate(), notes: t("دفعة جلسة تشمل: ") + sessionData.treatments.map(t=>t.tooth).join(", ")
                               });
                            }
                            if (sessionData.meds?.length > 0) {
                               const diagStr = sessionData.treatments.map(t => t.procedure).join(", ");
                               await createSmartPrescription({
                                 patient_id: parseInt(id), diagnosis: diagStr || "Dental Treatment",
                                 drugs: sessionData.meds, custom_info: { name: patient.first_name + " " + patient.last_name, age: patient.age, gender: patient.gender, date: localDate() }
                               });
                            }
                            setSessionStep(null);
                            load();
                          } catch (e) {
                            alert(t("حدث خطأ أثناء الحفظ: ") + e.message);
                          } finally {
                            setIsSavingSession(false);
                          }
                       }}>{isSavingSession ? t("جاري الحفظ...") : t("إنهاء وحفظ الجلسة") + " ✓"}</button>
                   </div>
                 </div>
               )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ClinicalTimeline({ patient, treatments, prescriptions, visits, pid, initialTooth }) {
  const { t, lang } = useLanguage();
  const { settings } = useSettings();
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTooth, setSelectedTooth] = useState(initialTooth || null);
  const [viewMode, setViewMode] = useState("teeth"); // Default to teeth mode as requested

  // Group events by date
  const eventsByDate = {};
  const allEvents = [
    ...treatments.map(t => ({ ...t, type: 'treatment' })),
    ...prescriptions.map(p => ({ ...p, type: 'prescription' })),
    ...visits.map(v => ({ ...v, type: 'visit' }))
  ];

  allEvents.forEach(ev => {
    const dateKey = ev.date ? ev.date.split(' ')[0] : 'Unknown';
    if (!eventsByDate[dateKey]) eventsByDate[dateKey] = { treatments: [], prescriptions: [], visits: [] };
    if (ev.type === 'treatment') eventsByDate[dateKey].treatments.push(ev);
    else if (ev.type === 'prescription') eventsByDate[dateKey].prescriptions.push(ev);
    else if (ev.type === 'visit') eventsByDate[dateKey].visits.push(ev);
  });

  const sortedDates = Object.keys(eventsByDate).sort((a, b) => new Date(a) - new Date(b));
  const sessionMapping = {};
  sortedDates.forEach((d, i) => sessionMapping[d] = i + 1);

  const displayDates = [...sortedDates].reverse();

  const teethHistory = {};
  treatments.forEach(tr => {
    if (!tr.tooth_number) {
       if (!teethHistory["General"]) teethHistory["General"] = [];
       teethHistory["General"].push(tr);
       return;
    }
    const s = String(tr.tooth_number).trim();
    if (s.toLowerCase() === "general") {
       if (!teethHistory["General"]) teethHistory["General"] = [];
       teethHistory["General"].push(tr);
       return;
    }
    const matches = s.match(/\d+/g);
    if (matches) {
      matches.forEach(m => {
        if (!teethHistory[m]) teethHistory[m] = [];
        if (!teethHistory[m].find(existing => existing.id === tr.id)) {
          teethHistory[m].push(tr);
        }
      });
    } else {
       if (!teethHistory[s]) teethHistory[s] = [];
       teethHistory[s].push(tr);
    }
  });

  const allTreatedTeeth = Object.keys(teethHistory);
  const totalTreatmentsCount = treatments.length;

  // Generate all tooth numbers 11-48
  const allToothNumbers = ["General"];
  for (let q = 1; q <= 4; q++) {
    for (let tNum = 1; tNum <= 8; tNum++) {
      allToothNumbers.push(`${q}${tNum}`);
    }
  }

  const activeTooth = selectedTooth || (allTreatedTeeth.length > 0 ? allTreatedTeeth[0] : "General");
  const currentToothHistory = teethHistory[activeTooth] || [];

  return (
    <div style={{ minHeight: 700 }}>
      {/* Debug Info (Hidden/Subtle) */}
      <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 10, display: "flex", flexWrap: "wrap", gap: 15 }}>
        <span>Total Logs: {totalTreatmentsCount}</span>
        <span>Found Teeth: {allTreatedTeeth.join(", ") || "None"}</span>
        <span style={{ color: "var(--primary)" }}>Raw Values: {treatments.slice(0, 5).map(t => `'${t.tooth_number}'`).join(", ")}</span>
      </div>

      {/* Header with toggle */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 30 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>🦷 {t("السجل المتكامل للأسنان")}</h2>
        <div style={{ background: "rgba(255,255,255,0.05)", padding: 4, borderRadius: 12, display: "flex", gap: 4 }}>
          <button onClick={() => setViewMode("teeth")} style={{ padding: "8px 16px", borderRadius: 10, border: "none", background: viewMode === "teeth" ? "var(--primary)" : "transparent", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>🦷 {t("حسب السن")}</button>
          <button onClick={() => setViewMode("sessions")} style={{ padding: "8px 16px", borderRadius: 10, border: "none", background: viewMode === "sessions" ? "var(--primary)" : "transparent", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>🗓️ {t("حسب الجلسة")}</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 32 }}>
        {viewMode === "teeth" ? (
          <>
            {/* Sidebar - Full Teeth Grid */}
            <div style={{ 
              borderLeft: lang==="ar"?"none":"1px solid rgba(255,255,255,0.08)", 
              borderRight: lang==="ar"?"1px solid rgba(255,255,255,0.08)":"none",
              paddingRight: lang==="ar"?16:0, paddingLeft: lang==="ar"?0:16,
              maxHeight: "70vh", overflowY: "auto"
            }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", letterSpacing: 1, marginBottom: 16 }}>{t("اختر رقم السن لعرض تاريخه")}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                {allToothNumbers.map(tid => {
                   const hasHistory = teethHistory[tid] && teethHistory[tid].length > 0;
                   return (
                    <div key={tid} 
                      onClick={() => setSelectedTooth(tid)}
                      style={{ 
                        aspectRatio: "1/1", borderRadius: 12, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                        background: activeTooth === tid ? "var(--primary)" : (hasHistory ? "rgba(0, 210, 255, 0.15)" : "rgba(255,255,255,0.03)"),
                        border: "1px solid",
                        borderColor: activeTooth === tid ? "var(--primary)" : (hasHistory ? "rgba(0, 210, 255, 0.4)" : "rgba(255,255,255,0.05)"),
                        color: activeTooth === tid ? "white" : (hasHistory ? "var(--primary)" : "var(--text-muted)"),
                        transition: "0.2s",
                        gridColumn: tid === "General" ? "span 4" : "auto",
                        height: tid === "General" ? 40 : "auto"
                      }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 800 }}>{tid === "General" ? "🌐 General" : tid}</div>
                      {hasHistory && tid !== "General" && <div style={{ width: 4, height: 4, borderRadius: "50%", background: activeTooth === tid ? "white" : "var(--primary)", marginTop: 2 }}></div>}
                    </div>
                   );
                })}
              </div>
            </div>

            {/* Main Content - Tooth History Summary */}
            <div style={{ maxHeight: "70vh", overflowY: "auto", paddingRight: 10 }}>
               <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                 <div style={{ width: 45, height: 45, borderRadius: 12, background: activeTooth === "General" ? "rgba(0, 210, 255, 0.1)" : "rgba(16, 185, 129, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>{activeTooth === "General" ? "🌐" : "🦷"}</div>
                 <div>
                   <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>{t("السجل المتكامل للسن")} {activeTooth === "General" ? t("العام") : `#${activeTooth}`}</h3>
                   <div style={{ fontSize: 13, color: currentToothHistory.length > 0 ? "var(--success)" : "var(--text-muted)", fontWeight: 600 }}>{currentToothHistory.length} {t("إجراءات مسجلة")}</div>
                 </div>
               </div>

               {currentToothHistory.length === 0 ? (
                 <div style={{ textAlign: "center", padding: "100px 0", color: "var(--text-muted)" }}>
                    <div style={{ fontSize: 40, marginBottom: 16 }}>📁</div>
                    <div>{t("لا توجد إجراءات مسجلة لهذا السن")}</div>
                 </div>
               ) : (
                 <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    {[...currentToothHistory].sort((a,b) => new Date(b.date) - new Date(a.date)).map((tr, i) => {
                      const dateKey = tr.date.split(' ')[0];
                      return (
                        <div key={i} 
                          onClick={() => {
                            setSelectedDate(dateKey);
                            setViewMode("sessions");
                          }}
                          className="action-card"
                          style={{ 
                            padding: 20, background: "rgba(255,255,255,0.03)", borderRadius: 16, 
                            borderLeft: "4px solid var(--primary)", position: "relative",
                            margin: 0, width: "auto"
                          }}>
                          <div style={{ position: "absolute", top: 20, left: lang==="ar"?"auto":20, right: lang==="ar"?20:"auto", fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}>
                            📅 {tr.date} {sessionMapping[dateKey] ? `· ${t("جلسة")} #${sessionMapping[dateKey]}` : ""}
                          </div>
                          <div style={{ marginTop: 15, width: "100%" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                              <div style={{ fontSize: 16, fontWeight: 800, color: "white" }}>{tr.procedure}</div>
                            </div>
                            {tr.notes && (
                              <div style={{ padding: 12, background: "rgba(0,0,0,0.2)", borderRadius: 10, fontSize: 13, color: "#cbd5e1", lineHeight: 1.5 }}>
                                {tr.notes}
                              </div>
                            )}
                            <div style={{ fontSize: 10, color: "var(--primary)", marginTop: 10, fontWeight: 700, textAlign: "left" }}>🔍 {t("انقر لعرض تفاصيل الجلسة الكاملة")}</div>
                          </div>
                        </div>
                      );
                    })}
                 </div>
               )}
            </div>
          </>
        ) : (
          <>
            {/* Sidebar - Sessions List */}
            <div style={{ 
              borderLeft: lang==="ar"?"none":"1px solid rgba(255,255,255,0.08)", 
              borderRight: lang==="ar"?"1px solid rgba(255,255,255,0.08)":"none",
              paddingRight: lang==="ar"?16:0, paddingLeft: lang==="ar"?0:16,
              maxHeight: "70vh", overflowY: "auto"
            }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", letterSpacing: 1, marginBottom: 16 }}>{t("كافة الجلسات")}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {displayDates.map(date => {
                  const activeDate = selectedDate || displayDates[0];
                  return (
                    <div key={date} 
                      onClick={() => setSelectedDate(date)}
                      style={{ 
                        padding: "16px", borderRadius: 16, cursor: "pointer",
                        background: activeDate === date ? "var(--primary)" : "rgba(255,255,255,0.02)",
                        border: "1px solid",
                        borderColor: activeDate === date ? "var(--primary)" : "rgba(255,255,255,0.05)",
                        color: activeDate === date ? "white" : "inherit",
                        transition: "all 0.3s",
                        boxShadow: activeDate === date ? "0 8px 20px -5px rgba(0, 210, 255, 0.4)" : "none",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                         <span style={{ fontWeight: 700, fontSize: 14 }}>{date}</span>
                         <span style={{ fontSize: 10, opacity: 0.6 }}>#{sessionMapping[date]}</span>
                      </div>
                      <div style={{ fontSize: 10, marginTop: 4, opacity: 0.8 }}>
                        {eventsByDate[date].treatments.length} {t("إجراء")} · {eventsByDate[date].prescriptions.length} {t("وصفة")}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Main Content - Session View */}
            <div style={{ maxHeight: "70vh", overflowY: "auto", paddingRight: 10 }}>
              {(() => {
                const activeDate = selectedDate || displayDates[0];
                const current = eventsByDate[activeDate] || { treatments: [], prescriptions: [], visits: [] };
                
                // Filter treatments for the current session based on activeTooth
                const filteredTreatments = current.treatments.filter(tr => 
                  !activeTooth || activeTooth === "General" || 
                  String(tr.tooth_number).split(/[\s,]+/).includes(activeTooth)
                );

                // Find diagnosis from prescriptions in this session
                const sessionPresc = current.prescriptions[0];
                const diagnosis = sessionPresc?.diagnosis || "";

                // Find payment for this session
                const sessionInvoice = patient.invoices?.find(inv => inv.date === activeDate);

                return (
                  <div className="animate-fade">
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 45, height: 45, borderRadius: 12, background: "rgba(0, 210, 255, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>📄</div>
                        <div>
                          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>{t("ملخص الجلسة رقم")} {sessionMapping[activeDate]} {activeTooth && activeTooth !== "General" ? `(${t("للسن")} #${activeTooth})` : ""}</h3>
                          <div style={{ fontSize: 13, color: "var(--primary)", fontWeight: 600 }}>📅 {activeDate}</div>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                      {/* 1. Diagnosis Section */}
                      <div className="glass-panel" style={{ padding: 20, borderLeft: "4px solid #f59e0b" }}>
                         <div style={{ fontSize: 12, fontWeight: 800, color: "#f59e0b", marginBottom: 8, letterSpacing: 1 }}>🔍 {t("التشخيص")}</div>
                         <div style={{ fontSize: 16, fontWeight: 700, color: "white" }}>{diagnosis || t("لم يتم تسجيل تشخيص محدد")}</div>
                      </div>

                      {/* 2. Treatments List */}
                      <div className="glass-panel" style={{ padding: 20 }}>
                        <div style={{ fontWeight: 800, marginBottom: 15, fontSize: 14, color: "var(--primary)", display: "flex", justifyContent: "space-between" }}>
                          <span>📋 {t("الإجراءات المنفذة")} {activeTooth && activeTooth !== "General" ? `(${t("للسن")} #${activeTooth})` : ""}</span>
                          <span>{filteredTreatments.length}</span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {filteredTreatments.map((tr, i) => (
                            <div key={i} style={{ padding: 12, background: "rgba(255,255,255,0.02)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.05)" }}>
                               <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                                   <span>{tr.tooth_number === "General" ? `🌐 ${t("إجراء عام")}` : `🦷 #${tr.tooth_number}`}</span>
                               </div>
                               <div style={{ fontSize: 13, color: "white" }}>{tr.procedure}</div>
                               {tr.notes && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6, fontStyle: "italic" }}>{tr.notes}</div>}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 3. Prescriptions & Invoices */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                        <div className="glass-panel" style={{ padding: 20 }}>
                           <div style={{ fontWeight: 800, marginBottom: 15, fontSize: 14, color: "var(--success)" }}>💊 {t("الوصفة الطبية")}</div>
                           {current.prescriptions.length > 0 ? (
                             current.prescriptions.map((pr, i) => (
                               <div key={i} style={{ fontSize: 13 }}>
                                 <div style={{ fontWeight: 700 }}>{pr.meds}</div>
                                 <button onClick={() => window.open(getPrescriptionPDFUrl(pr.id), "_blank")} className="btn-ghost" style={{ padding: "4px 8px", fontSize: 11, marginTop: 8 }}>📄 {t("تحميل PDF")}</button>
                               </div>
                             ))
                           ) : <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("لم يتم صرف أدوية")}</div>}
                        </div>

                        <div className="glass-panel" style={{ padding: 20 }}>
                           <div style={{ fontWeight: 800, marginBottom: 15, fontSize: 14, color: "#10b981" }}>💵 {t("المدفوعات")}</div>
                           {sessionInvoice ? (
                             <div>
                               <div style={{ fontSize: 18, fontWeight: 800, color: "white" }}>{(sessionInvoice.paid || sessionInvoice.paid_amount || 0).toLocaleString()} د</div>
                               <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{t("طريقة الدفع")}: {sessionInvoice.payment_method}</div>
                             </div>
                           ) : <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("لم يتم تسجيل دفعات لهذه الجلسة")}</div>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Modal({ title, onClose, children, width = 600 }) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 20 }}>
      <div className="glass-panel animate-fade" style={{ width: "100%", maxWidth: width, padding: isMobile ? 16 : 32, maxHeight: "95vh", overflowY: "auto", position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
          <h3 style={{ fontSize: 20 }}>{title}</h3>
          <button onClick={onClose} className="btn-ghost" style={{ fontSize: 20, padding: "0 10px" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  , document.body);
}

const FormInput = ({ label, val, onChange, readOnly, type = "text" }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
    <input className="glass-input" style={{ width: "100%", textAlign: "center" }} 
      type={type} placeholder={label} value={val || ""} readOnly={readOnly}
      onChange={e => onChange && onChange(e.target.value)} />
  </div>
);

const ActionButton = ({ icon, label, onClick }) => (
  <button className="glass-panel" style={{ 
    display: "flex", alignItems: "center", gap: 16, padding: "16px 24px", 
    width: "100%", textAlign: "left", cursor: "pointer", border: "1px solid rgba(255,255,255,0.1)" 
  }} onClick={onClick}>
    <span style={{ fontSize: 24 }}>{icon}</span>
    <span style={{ fontWeight: 600 }}>{label}</span>
  </button>
);

const lblStyle = { display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 6 };

const DetailRow = ({ label, val, color }) => (
  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
    <span style={{ color: "var(--text-muted)" }}>{label}:</span>
    <span style={{ color: color || "white", fontWeight: 500 }}>{val}</span>
  </div>
);

const InfoBox = ({ label, val }) => (
  <div>
    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>
    <div style={{ padding: 12, background: "rgba(255,255,255,0.03)", borderRadius: 8, fontSize: 13 }}>{val || "—"}</div>
  </div>
);
