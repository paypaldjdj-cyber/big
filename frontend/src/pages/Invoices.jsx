
import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../LanguageContext";
import { useAuth } from "../AuthContext";
import { getInvoices, getInvoiceSummary, addInvoice, payInvoice, getPatients, getInvoicePDFUrl, getDailySummaryPDFUrl, BASE } from "../api";
import { useSettings } from "../SettingsContext";

const localDate = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

const StatItem = ({ label, value, color }) => {
  const { t } = useLanguage();
  return (
    <div className="glass-panel" style={{ padding: 16 }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{t(label)}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color || "white" }}>{value}</div>
    </div>
  );
};

const lblStyle = { display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 6 };

export default function Invoices() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { settings } = useSettings();
  const searchRef = useRef(null);
  const isSecretary = user?.role === "secretary";
  const [invoices, setInvoices] = useState([]);
  const [summary, setSummary] = useState({});
  const [patients, setPatients] = useState([]);
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(false);
  const [payModal, setPayModal] = useState(null);
  const [form, setForm] = useState({ patient_id: "", agreed_price: "", paid: "", payment_method: "Cash", date: localDate(), notes: "" });
  const [payAmt, setPayAmt] = useState("");
  const [printReceipt, setPrintReceipt] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showResults, setShowResults] = useState(false);

  const load = () => {
    getInvoices(q, "").then(setInvoices).catch(console.error);
    getInvoiceSummary().then(setSummary).catch(console.error);
    getPatients().then(setPatients).catch(console.error);
  };
  useEffect(() => { load(); }, [q]);
  useEffect(() => { getPatients().then(setPatients).catch(console.error); }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const save = async () => {
    if (!form.patient_id || !form.agreed_price) return alert(t("أدخل المريض والمبلغ"));

    if (form.paid && parseFloat(form.paid) % 500 !== 0) {
      return alert(t("⚠️ عذراً، يجب أن يكون مبلغ الدفعة من مضاعفات الـ 500 دينار عراقي."));
    }

    const paidAmt = parseFloat(form.paid) || 0;
    const requiredAmt = parseFloat(form.agreed_price) || 0;

    if (paidAmt > requiredAmt) {
      return alert(t("⚠️ لا يمكن إدخال مبلغ يتجاوز مديونية المريض المتبقية (") + requiredAmt + " " + t("د)"));
    }

    const selectedP = patients.find(p => p.id == form.patient_id);
    const patientTotal = selectedP?.total_price || requiredAmt;

    const res = await addInvoice({
      patient_id: parseInt(form.patient_id),
      total_amount: patientTotal,
      paid_amount: paidAmt,
      payment_method: form.payment_method,
      notes: form.notes,
      date: form.date
    });

    if (res.ok) {
       // We'd ideally need the ID of the new invoice to print PDF immediately.
       // For now, let's just refresh, the user can print from the table.
       // Or the backend 'addInvoice' should return the ID.
    }

    setModal(false); load();
    setSearchTerm("");
  };

  const printPDFReceipt = async (invoiceId) => {
    const url = getInvoicePDFUrl(invoiceId);
    try {
      const user = JSON.parse(localStorage.getItem("clinic_user") || "{}");
      const res = await fetch(url, { headers: { "Authorization": `Bearer ${user.token}` } });
      const blob = await res.blob();
      window.open(URL.createObjectURL(blob), "_blank");
    } catch (e) {
      console.error("PDF error:", e);
      alert("فشل في استرداد وصل الاستلام");
    }
  };

  const filteredPatients = patients.filter(p =>
    `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.phone?.includes(searchTerm)
  );

  const pay = async () => {
    if (!payAmt) return;
    await payInvoice(payModal.id, parseFloat(payAmt));
    setPayModal(null); setPayAmt(""); load();
  };

  return (
    <div className="animate-fade">
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>{t("الفواتير والمدفوعات")}</h2>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={async () => {
            const url = getDailySummaryPDFUrl();
            try {
              const user = JSON.parse(localStorage.getItem("clinic_user") || "{}");
              const res = await fetch(url, { headers: { "Authorization": `Bearer ${user.token}` } });
              const blob = await res.blob();
              window.open(URL.createObjectURL(blob), "_blank");
            } catch (e) {
              console.error("PDF error:", e);
              alert("فشل في استرداد ملخص اليوم");
            }
          }} className="btn-secondary" style={{ padding: "8px 16px" }}>🖨 {t("طباعة التقرير")}</button>
          <button onClick={() => { setForm({ patient_id: "", agreed_price: "", paid: "", payment_method: "Cash", date: localDate(), notes: "" }); setSearchTerm(""); setModal(true); }} className="btn-primary">
            <span>+</span> {t("إصدار فاتورة جديدة")}
          </button>
        </div>
      </div>

      <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 12, marginBottom: 20 }}>
        <StatItem label={isSecretary ? "إجمالي فواتير اليوم" : "إجمالي الفواتير"} value={(isSecretary ? (summary.today_total || 0) : (summary.total || 0)).toLocaleString() + " د"} />
        <StatItem label={isSecretary ? "المبالغ المحصلة اليوم" : "المبالغ المحصلة"} value={(isSecretary ? (summary.today_collected || 0) : (summary.collected || 0)).toLocaleString() + " د"} color="var(--success)" />
        <StatItem label="الديون المتبقية" value={(summary.debt || 0).toLocaleString() + " د"} color="var(--danger)" />
      </div>

      <div className="glass-panel" style={{ padding: 16, marginBottom: 20 }}>
        <input className="glass-input" placeholder={t("ابحث باسم المريض...")} value={q} onChange={e => setQ(e.target.value)} style={{ width: "100%" }} />
      </div>

      <div className="glass-panel">
        <div className="table-container">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                {[t("المريض"), t("التاريخ"), t("السعر الكلي للعلاج"), t("المدفوع الآن"), t("دين المريض الكلي"), t("الحالة"), t("إجراء")].map(h => (
                  <th key={h} style={{ padding: "16px 20px", textAlign: "right", fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.map(i => (
                <tr key={i.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <td style={{ padding: "14px 20px", fontWeight: 500 }}>{i.patient_name}</td>
                  <td style={{ padding: "14px 20px", fontSize: 13, color: "var(--text-muted)" }}>{i.date}</td>
                  <td style={{ padding: "14px 20px", fontSize: 13 }}>{(i.total_price || 0).toLocaleString()} د</td>
                  <td style={{ padding: "14px 20px", fontSize: 13, color: "var(--success)" }}>{(i.paid || 0).toLocaleString()} د</td>
                  <td style={{ padding: "14px 20px", fontSize: 13, color: "var(--danger)", fontWeight: 700 }}>{Math.max(0, i.patient_debt || 0).toLocaleString()} د</td>
                  <td style={{ padding: "14px 20px" }}>
                    <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 20, background: i.status === "مدفوع" ? "rgba(16, 185, 129, 0.1)" : "rgba(245, 158, 11, 0.1)", color: i.status === "مدفوع" ? "#10b981" : "#f59e0b" }}>{t(i.status)}</span>
                  </td>
                  <td style={{ padding: "14px 20px" }}>
                    <button onClick={() => printPDFReceipt(i.id)} className="btn-ghost" style={{ padding: "5px 12px", fontSize: 12 }}>🖨</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && createPortal(
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="glass-panel animate-fade" style={{ width: "100%", maxWidth: 520, padding: 32 }}>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>{t("إصدار فاتورة جديدة")}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ position: "relative" }} ref={searchRef}>
                <label style={lblStyle}>{t("المريض")}</label>
                <div style={{ position: "relative" }}>
                  <input className="glass-input" style={{ width: "100%", paddingRight: 40 }} placeholder={t("بحث عن مريض...")} value={searchTerm} onFocus={() => setShowResults(true)} onChange={e => { setSearchTerm(e.target.value); setShowResults(true); if (!e.target.value) setForm({ ...form, patient_id: "" }); }} />
                  <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", opacity: 0.5 }}>🔍</span>
                </div>
                {showResults && searchTerm && (
                  <div className="glass-panel" style={{ position: "absolute", top: "105%", left: 0, right: 0, zIndex: 100, maxHeight: 240, overflowY: "auto", padding: 8, boxShadow: "0 20px 50px rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.1)" }}>
                    {filteredPatients.length === 0 ? <div style={{ padding: 12, color: "var(--text-muted)", textAlign: "center", fontSize: 13 }}>{t("لا يوجد نتائج")}</div> : filteredPatients.map(p => (
                      <div key={p.id} onClick={() => { setForm({ ...form, patient_id: p.id, agreed_price: p.debt || 0 }); setSearchTerm(`${p.first_name} ${p.last_name}`); setShowResults(false); }} style={{ padding: "10px 16px", cursor: "pointer", borderRadius: 10, background: form.patient_id == p.id ? "rgba(24, 95, 165, 0.3)" : "transparent", marginBottom: 4 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div><div style={{ fontWeight: 600 }}>{p.first_name} {p.last_name}</div>{p.phone && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>📞 {p.phone}</div>}</div>
                          {p.debt > 0 && <div style={{ fontSize: 12, color: "#ef4444", fontWeight: 700 }}>{(p.debt || 0).toLocaleString()} {t("د")}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div><label style={lblStyle}>{t("المبلغ المطلوب (الدين)")}</label><input type="number" readOnly className="glass-input" style={{ width: "100%", background: "rgba(255,255,255,0.02)" }} value={form.agreed_price} /></div>
                <div><label style={lblStyle}>{t("الدفعة الحالية")}</label><input type="number" step="500" className="glass-input" style={{ width: "100%" }} value={form.paid} onChange={e => setForm({ ...form, paid: e.target.value })} /></div>
              </div>
              <div>
                <label style={lblStyle}>{t("طريقة الدفع")}</label>
                <div style={{ display: "flex", gap: 10 }}>
                  {["Cash", "Bank"].map(m => (
                    <button key={m} onClick={() => setForm({ ...form, payment_method: m })} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `2px solid ${form.payment_method === m ? (m === 'Cash' ? '#10b981' : '#00D2FF') : 'transparent'}`, background: form.payment_method === m ? (m === 'Cash' ? 'rgba(16,185,129,0.15)' : 'rgba(0,210,255,0.15)') : 'rgba(255,255,255,0.04)', color: form.payment_method === m ? (m === 'Cash' ? '#10b981' : '#00D2FF') : 'var(--text-muted)', fontWeight: 600 }}>{m === 'Cash' ? t("Cash (الخزنة)") : t("Bank (البنك)")}</button>
                  ))}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div><label style={lblStyle}>{t("التاريخ")}</label><input type="date" className="glass-input" style={{ width: "100%" }} value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
                <div><label style={lblStyle}>{t("ملاحظات")}</label><input className="glass-input" style={{ width: "100%" }} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
              <button onClick={() => setModal(false)} className="btn-ghost" style={{ flex: 1 }}>{t("إلغاء")}</button>
              <button onClick={save} className="btn-primary" style={{ flex: 1 }}>{t("حفظ الفاتورة")}</button>
            </div>
          </div>
        </div>
        , document.body)}
    </div>
  );
}
