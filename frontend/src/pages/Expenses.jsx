import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../LanguageContext";
import { useAuth } from "../AuthContext";
import { getExpenses, addExpense, deleteExpense } from "../api";
import ConfirmModal from "../components/ConfirmModal";

const localDate = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export default function Expenses() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const isSecretary = user?.role === "secretary";
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [modal, setModal] = useState(false);
  const [confirmData, setConfirmData] = useState({ show: false, message: "", onConfirm: null });
  const [form, setForm] = useState({ category: "أخرى", amount: "", payment_method: "Cash", date: localDate(), notes: "" });

  const load = () => {
    getExpenses().then(data => {
      const today = localDate();
      const filtered = isSecretary ? data.filter(e => e.date === today) : data;
      setList(filtered);
      setTotal(filtered.reduce((s, e) => s + e.amount, 0));
    }).catch(console.error);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.amount) return alert(t("أدخل المبلغ"));
    await addExpense({ ...form, amount: parseFloat(form.amount) });
    setModal(false); load();
  };

  const del = (id) => {
    setConfirmData({
      show: true,
      message: t("هل تريد حذف هذا البند؟"),
      onConfirm: async () => {
        setConfirmData({ show: false });
        await deleteExpense(id);
        load();
      }
    });
  };

  const cats = ["إيجار", "مواد طبية", "كهرباء ومياه", "رواتب", "صيانة", "إعلان", "أخرى"];

  return (
    <div className="animate-fade">
      <div className="expenses-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>{isSecretary ? t("مصاريف اليوم") : t("المصاريف التشغيلية")}</h2>
        <button onClick={() => setModal(true)} className="btn-primary">
          <span>+</span> {t("إضافة مصروف")}
        </button>
      </div>

      <div className="glass-panel expenses-summary" style={{ padding: 24, marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between", background: "linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(24, 95, 165, 0.05))" }}>
        <div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 4 }}>{isSecretary ? t("إجمالي مصاريف اليوم") : t("إجمالي المصاريف المسجلة")}</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "var(--danger)" }}>{(total || 0).toLocaleString()} {t("د")}</div>
        </div>
        <div style={{ fontSize: 40 }}>💸</div>
      </div>

      <div className="glass-panel">
        <div className="table-container">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                {[t("التاريخ"), t("الفئة"), t("الملاحظات"), t("طريقة الدفع"), t("المبلغ"), t("إجراء")].map(h => (
                  <th key={h} style={{ padding: "16px 20px", textAlign: "right", fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map(e => (
                <tr key={e.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <td style={{ padding: "14px 20px", fontSize: 13, color: "var(--text-muted)" }}>{e.date}</td>
                  <td style={{ padding: "14px 20px" }}>
                    <span style={{ fontSize: 12, padding: "4px 10px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid var(--glass-border)" }}>{t(e.category)}</span>
                  </td>
                  <td style={{ padding: "14px 20px", fontSize: 13 }}>{e.notes || "—"}</td>
                  <td style={{ padding: "14px 20px" }}>
                    <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: e.payment_method === 'Bank' ? 'rgba(0,210,255,0.1)' : 'rgba(16,185,129,0.1)', color: e.payment_method === 'Bank' ? '#00D2FF' : '#10b981' }}>{e.payment_method || 'Cash'}</span>
                  </td>
                  <td style={{ padding: "14px 20px", fontWeight: 700, color: "var(--danger)" }}>{(e.amount || 0).toLocaleString()} {t("د")}</td>
                  <td style={{ padding: "14px 20px" }}>
                    <button onClick={() => del(e.id)} className="btn-ghost" style={{ padding: "5px 12px", fontSize: 12, color: "var(--danger)" }}>{t("حذف")}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {list.length === 0 && <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>{t("لا توجد مصاريف مسجلة")}</div>}
      </div>

      {modal && createPortal(
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="glass-panel animate-fade" style={{ width: "100%", maxWidth: 480, padding: 32 }}>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>{t("إضافة مصروف جديد")}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={lblStyle}>{t("الفئة")}</label>
                <select className="glass-input" style={{ width: "100%" }} value={form.category} onChange={v => setForm({ ...form, category: v.target.value })}>
                  {cats.map(c => <option key={c} value={c}>{t(c)}</option>)}
                </select>
              </div>
              <div className="grid-2">
                <div><label style={lblStyle}>{t("المبلغ")}</label><input type="number" className="glass-input" style={{ width: "100%" }} value={form.amount} onChange={v => setForm({ ...form, amount: v.target.value })} /></div>
                <div><label style={lblStyle}>{t("التاريخ")}</label><input type="date" className="glass-input" style={{ width: "100%" }} value={form.date} onChange={v => setForm({ ...form, date: v.target.value })} /></div>
              </div>
              <div>
                <label style={lblStyle}>{t("طريقة الدفع")}</label>
                <div style={{ display: "flex", gap: 10 }}>
                  {["Cash", "Bank"].map(m => (
                    <button key={m} onClick={() => setForm({ ...form, payment_method: m })}
                      style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `2px solid ${form.payment_method === m ? (m === 'Cash' ? '#10b981' : '#00D2FF') : 'transparent'}`, background: form.payment_method === m ? (m === 'Cash' ? 'rgba(16,185,129,0.15)' : 'rgba(0,210,255,0.15)') : 'rgba(255,255,255,0.04)', color: form.payment_method === m ? (m === 'Cash' ? '#10b981' : '#00D2FF') : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer', fontSize: 14, transition: 'all 0.15s' }}>
                      {m === 'Cash' ? t("Cash (الخزنة)") : t("Bank (البنك)")}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={lblStyle}>{t("ملاحظات")}</label>
                <input className="glass-input" style={{ width: "100%" }} value={form.notes} onChange={v => setForm({ ...form, notes: v.target.value })} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
              <button onClick={() => setModal(false)} className="btn-ghost" style={{ flex: 1 }}>{t("إلغاء")}</button>
              <button onClick={save} className="btn-primary" style={{ flex: 1 }}>{t("حفظ")}</button>
            </div>
          </div>
        </div>
        , document.body)}
      <style>{`
        .mobile-mode .expenses-header {
          flex-direction: column !important;
          align-items: stretch !important;
          gap: 16px !important;
        }
        .mobile-mode .expenses-summary {
          padding: 16px !important;
        }
        .mobile-mode .expenses-summary div:first-child div:last-child {
          font-size: 24px !important;
        }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .mobile-mode .grid-2 { grid-template-columns: 1fr; }
      `}</style>

      <ConfirmModal 
        show={confirmData.show} 
        title={t("تأكيد الحذف")} 
        message={confirmData.message} 
        danger={true}
        onConfirm={confirmData.onConfirm} 
        onCancel={() => setConfirmData({ ...confirmData, show: false })} 
      />
    </div>
  );
}

const lblStyle = { display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 6 };
