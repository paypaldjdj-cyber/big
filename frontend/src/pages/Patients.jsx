import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLanguage } from "../LanguageContext";
import { getPatients, addPatient } from "../api";
import { createPortal } from "react-dom";
const localDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

const lblStyle = { display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 6 };

export default function Patients() {


  const { t } = useLanguage();
  const [patients, setPatients] = useState([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [q,        setQ]        = useState(searchParams.get("q") || "");
  const [status,   setStatus]   = useState("");
  const [modal,    setModal]    = useState(false);
  const [form,     setForm]     = useState({ 
    first_name:"", last_name:"", phone:"", gender:"Male", age:"", address:"", case_category:"", teeth: {},
    payment_system: "total", total_agreed_price: "", initial_payment: "", payment_method: "Cash"
  });
  const [saving,   setSaving]   = useState(false);
  const nav = useNavigate();

  const load = () => getPatients(q, status).then(setPatients).catch(console.error);
  useEffect(() => { load(); }, [q, status]);

  const save = async () => {
    if (!form.first_name || !form.last_name) return alert(t("الرجاء إدخال الاسم"));
    
    if (form.payment_system === "total" && form.total_agreed_price && parseFloat(form.total_agreed_price) % 500 !== 0) {
      return alert(t("⚠️ عذراً، لا يمكن إدخال هذا الرقم. يرجى إدخال مبلغ (السعر الكلي) صحيح من مضاعفات الـ 500 دينار عراقي."));
    }
    if (form.initial_payment && parseFloat(form.initial_payment) % 500 !== 0) {
      return alert(t("⚠️ عذراً، لا يمكن إدخال هذا الرقم. يرجى إدخال مبلغ (الدفعة الأولى) صحيح من مضاعفات الـ 500 دينار عراقي."));
    }

    setSaving(true);
    const res = await addPatient(form).catch(console.error);
    if (res && res.id) {
      const { saveTeeth, addInvoice } = await import("../api");
      if (form.teeth && Object.keys(form.teeth).length > 0) {
        await saveTeeth(res.id, form.teeth).catch(console.error);
      }
      if (form.total_agreed_price || form.initial_payment) {
        await addInvoice({
          patient_id: res.id,
          amount: form.payment_system === 'total' ? (parseFloat(form.total_agreed_price) || 0) : 0,
          paid: parseFloat(form.initial_payment) || 0,
          payment_method: form.payment_method || "Cash",
          date: localDate(),
          notes: t("الدفعة الأولى عند التسجيل")
        }).catch(console.error);
      }
    }
    setSaving(false);
    setModal(false);
    setForm({ 
      first_name:"", last_name:"", phone:"", gender:"Male", age:"", address:"", 
      case_category:"", teeth:{}, payment_system: "total", total_agreed_price: "", initial_payment: "", payment_method: "Cash"
    });
    load();
  };

  return (
    <div className="animate-fade">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>{t("إدارة المرضى")}</h2>
        <button onClick={() => setModal(true)} className="btn-primary">
          <span>+</span> {t("إضافة مريض جديد")}
        </button>
      </div>

      {/* Toolbar */}
      <div className="glass-panel patient-toolbar" style={{ padding: 12, marginBottom: 20, display: "flex", gap: 12 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <span style={{ position: "absolute", right: 12, top: 10, color: "var(--text-muted)" }}>🔍</span>
          <input className="glass-input" placeholder={t("ابحث بالاسم أو الهاتف...")} 
            value={q} onChange={e => {
              setQ(e.target.value);
              setSearchParams(e.target.value ? { q: e.target.value } : {});
            }}
            style={{ width: "100%", paddingRight: 36 }} />
        </div>
        <select className="glass-input status-select" value={status} onChange={e => setStatus(e.target.value)} style={{ width: 160 }}>
          <option value="">{t("جميع الحالات")}</option>
          <option value="جديد">{t("جديد")}</option>
          <option value="منتظم">{t("منتظم")}</option>
          <option value="مديون">{t("مديون")}</option>
        </select>
      </div>

      <style>{`
        .mobile-mode .patient-toolbar {
          flex-direction: column !important;
        }
        .mobile-mode .status-select {
          width: 100% !important;
        }
      `}</style>

      {/* Table */}
      <div className="glass-panel">
        <div className="table-container">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                {[t("المريض"), t("الهاتف"), t("التواصل"), t("العمر"), t("آخر زيارة"), t("المستحق"), t("الحالة")].map(h => (
                  <th key={h} style={{ padding: "16px 20px", textAlign: "right", fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {patients.map((p, i) => {
                const age = p.age || (p.birth_date ? Math.floor((Date.now() - new Date(p.birth_date)) / (365.25 * 864e5)) : "—");
                return (
                  <tr key={p.id} className="table-row" onClick={() => nav(`/patients/${p.id}`)} style={{ cursor: "pointer" }}>
                    <td style={{ padding: "14px 20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #185FA5, #00D2FF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600 }}>
                          {p.first_name?.[0]}{p.last_name?.[0]}
                        </div>
                        <div style={{ fontWeight: 500 }}>{p.first_name} {p.last_name}</div>
                      </div>
                    </td>
                    <td style={{ padding: "14px 20px", color: "var(--text-muted)", fontSize: 13 }}>{p.phone || "—"}</td>
                    <td style={{ padding: "14px 20px" }}>
                      {p.phone ? (
                        <div style={{ display: "flex", gap: 10 }} onClick={e => e.stopPropagation()}>
                          <a href={`https://wa.me/${p.phone.startsWith('0') ? '964' + p.phone.slice(1).replace(/[^0-9]/g, '') : p.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="contact-btn wa-btn" title="WhatsApp">
                            <span style={{ fontSize: 16 }}>💬</span>
                          </a>
                          <a href={`tel:${p.phone}`} className="contact-btn tel-btn" title="Call">
                            <span style={{ fontSize: 16 }}>📞</span>
                          </a>
                        </div>
                      ) : <span style={{ color: "var(--text-muted)", fontSize: 11 }}>—</span>}
                    </td>
                    <td style={{ padding: "14px 20px", fontSize: 13 }}>{age !== "—" ? `${age} ${t("سنة")}` : "—"}</td>
                    <td style={{ padding: "14px 20px", fontSize: 13, color: "var(--text-muted)" }}>{p.last_visit || "—"}</td>
                    <td style={{ padding: "14px 20px", fontSize: 13, color: "var(--danger)", fontWeight: 700 }}>{(p.debt || 0).toLocaleString()} {t("د")}</td>
                    <td style={{ padding: "14px 20px" }}>
                      <span style={{ 
                        fontSize: 11, padding: "4px 10px", borderRadius: 20,
                        background: p.status === "منتظم" ? "rgba(24, 95, 165, 0.1)" : p.status === "مديون" ? "rgba(239, 68, 68, 0.1)" : "rgba(16, 185, 129, 0.1)",
                        color: p.status === "منتظم" ? "#185FA5" : p.status === "مديون" ? "#ef4444" : "#10b981"
                      }}>{t(p.status)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {patients.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>{t("لا توجد نتائج")}</div>
        )}
      </div>

      {/* Modal */}
      {modal && createPortal(
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", overflowY: "auto", padding: "40px 10px" }}>
          <div className="glass-panel animate-fade" style={{ width: "100%", maxWidth: 650, padding: 32, maxHeight: "95vh", overflowY: "auto" }}>
            <h3 style={{ fontSize: 24, fontWeight: 700, marginBottom: 32, textAlign: "center" }}>{t("إضافة مريض جديد")}</h3>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div><label style={lblStyle}>{t("الاسم الأول")}</label><input className="glass-input" style={{ width: "100%" }} value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} /></div>
              <div><label style={lblStyle}>{t("اسم العائلة")}</label><input className="glass-input" style={{ width: "100%" }} value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} /></div>
              <div><label style={lblStyle}>{t("رقم الهاتف")}</label><input className="glass-input" style={{ width: "100%" }} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              <div><label style={lblStyle}>{t("العنوان")}</label><input className="glass-input" style={{ width: "100%" }} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
              
              <div style={{ display: "flex", gap: 20 }}>
                <div style={{ flex: 1 }}><label style={lblStyle}>{t("العمر")}</label><input type="number" className="glass-input" style={{ width: "100%" }} value={form.age} onChange={e => setForm({ ...form, age: e.target.value })} /></div>
                <div style={{ flex: 1 }}>
                  <label style={lblStyle}>{t("الجنس")}</label>
                  <select className="glass-input" style={{ width: "100%" }} value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}>
                    <option value="Male">{t("ذكر")}</option>
                    <option value="Female">{t("أنثى")}</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={lblStyle}>{t("نظام المحاسبة")}</label>
                <div style={{ display: "flex", gap: 20, padding: 12, background: "rgba(255,255,255,0.03)", borderRadius: 12 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <input type="radio" checked={form.payment_system === "total"} onChange={() => setForm({ ...form, payment_system: "total" })} /> {t("مبلغ كلي")}
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <input type="radio" checked={form.payment_system === "sessions"} onChange={() => setForm({ ...form, payment_system: "sessions", total_agreed_price: "" })} /> {t("نظام جلسات")}
                  </label>
                </div>
              </div>

              <div className="grid-2" style={{ marginTop: 10 }}>
                {form.payment_system === "total" ? (
                  <div><label style={lblStyle}>{t("السعر الكلي المتفق عليه")}</label><input type="number" step="500" className="glass-input" style={{ width: "100%" }} placeholder="IQD" value={form.total_agreed_price} onChange={e => setForm({ ...form, total_agreed_price: e.target.value })} /></div>
                ) : (
                  <div></div>
                )}
                <div>
                  <label style={lblStyle}>{t("الدفعة الأولى")}</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input type="number" step="500" className="glass-input" style={{ flex: 1 }} placeholder="IQD" value={form.initial_payment} onChange={e => setForm({ ...form, initial_payment: e.target.value })} />
                    <select className="glass-input" style={{ width: 140 }} value={form.payment_method || "Cash"} onChange={e => setForm({ ...form, payment_method: e.target.value })}>
                      <option value="Cash">{t("Cash (الخزنة)")}</option>
                      <option value="Bank">{t("Bank (البنك)")}</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label style={lblStyle}>{t("نوع الحالة")}</label>
                <select className="glass-input" style={{ width: "100%" }} value={form.case_category} onChange={e => setForm({ ...form, case_category: e.target.value })}>
                  <option value="">{t("اختر النوع...")}</option>
                  {["Re Endodontic", "Filling", "Endodontic Treatment", "Extraction", "Surgery", "Implant Surgery", "Implant Prosthetic", "Removable Prosthetics", "Crown and Bridge", "Periodontic", "Pediatric", "Orthodontic", "Teeth Whitening", "Diagnosis", "X-Ray", "Item Purchase", "Other"].map(c => (
                    <option key={c} value={c}>{t(c)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 40 }}>
              <button onClick={() => setModal(false)} className="btn-ghost" style={{ width: 120 }}>{t("إلغاء")}</button>
              <button onClick={save} disabled={saving} className="btn-primary" style={{ width: 200 }}>{saving ? t("جاري الحفظ...") : t("إضافة المريض")}</button>
            </div>
          </div>
        </div>
      , document.body)}


      <style>{`
        .table-row:hover { background: rgba(255,255,255,0.06); }
        .contact-btn { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; cursor: pointer; text-decoration: none; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .wa-btn { background: rgba(34, 197, 94, 0.2); color: #22c55e; border: 1px solid rgba(34, 197, 94, 0.3); }
        .tel-btn { background: rgba(234, 179, 8, 0.2); color: #eab308; border: 1px solid rgba(234, 179, 8, 0.3); }
        .contact-btn:hover { transform: translateY(-3px); box-shadow: 0 6px 16px rgba(0,0,0,0.2); filter: brightness(1.2); }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .mobile-mode .grid-2 { grid-template-columns: 1fr; }
      `}</style>
    </div>
  );
}

