import React, { useState, useEffect } from "react";
import { useLanguage } from "../LanguageContext";
import { useAuth } from "../AuthContext";
import { useNavigate } from "react-router-dom";
import { getInvoices, getExpenses, getAppointments, getPatients, getAllTreatments, getAuditLogs, getDailySummaryPDFUrl } from "../api";

const fmt = (n) => (n || 0).toLocaleString();

export default function DailySummary() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const nav = useNavigate();
  const [data, setData] = useState({
    invoices: [],
    expenses: [],
    appointments: [],
    new_patients: [],
    treatments: [],
    inventory_logs: [],
    stats: { 
        total_income: 0, cash_income: 0, bank_income: 0,
        total_expense: 0, cash_expense: 0, bank_expense: 0,
        net: 0, patients_treated: 0, new_patients_count: 0,
        apt_completed: 0, apt_no_show: 0
    }
  });
  const [loading, setLoading] = useState(true);

  const getLocalDate = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  const today = getLocalDate();

  useEffect(() => {
    if (user?.role === 'secretary') {
      nav("/");
      return;
    }
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [invRes, expRes, aptRes, patRes, treatRes, auditRes] = await Promise.all([
        getInvoices("", "", today).catch(() => []),
        getExpenses(today).catch(() => []),
        getAppointments(today).catch(() => []),
        getPatients("", "", today).catch(() => []),
        getAllTreatments(today).catch(() => []),
        getAuditLogs("", today).catch(() => [])
      ]);

      const income_cash = invRes.filter(i => (i.payment_method || "").toLowerCase() === 'cash').reduce((a, c) => a + (parseFloat(c.paid) || parseFloat(c.amount_paid) || 0), 0);
      const income_bank = invRes.filter(i => (i.payment_method || "").toLowerCase() === 'bank').reduce((a, c) => a + (parseFloat(c.paid) || parseFloat(c.amount_paid) || 0), 0);
      
      const exp_cash = expRes.filter(e => e.payment_method === 'Cash').reduce((a, c) => a + (parseFloat(c.amount) || 0), 0);
      const exp_bank = expRes.filter(e => e.payment_method === 'Bank').reduce((a, c) => a + (parseFloat(c.amount) || 0), 0);

      const inv_consumption = auditRes.filter(log => log.action === 'DECREASE_STOCK');

      setData({
        invoices: invRes,
        expenses: expRes,
        appointments: aptRes,
        new_patients: patRes,
        treatments: treatRes,
        inventory_logs: inv_consumption,
        stats: {
          total_income: income_cash + income_bank,
          cash_income: income_cash,
          bank_income: income_bank,
          total_expense: exp_cash + exp_bank,
          cash_expense: exp_cash,
          bank_expense: exp_bank,
          net: (income_cash + income_bank) - (exp_cash + exp_bank),
          patients_treated: new Set(aptRes.filter(a => a.status === 'completed' || a.status === 'finished').map(a => a.patient_id)).size,
          new_patients_count: patRes.length,
          apt_completed: aptRes.filter(a => a.status === 'completed' || a.status === 'finished').length,
          apt_no_show: aptRes.filter(a => a.status === 'absent' || a.status === 'cancelled').length
        }
      });
    } catch (e) {
      console.error("Error loading daily summary:", e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center" }}>{t("جاري تحميل الملخص اليومي...")}</div>;

  return (
    <div className="animate-fade" style={{ direction: lang === "ar" ? "rtl" : "ltr" }}>
      <StyleTag />
      
      {/* ── Screen View (UI) ── */}
      <div className="no-print">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
          <div>
            <h2 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>📊 {t("ملخص الجرد اليومي الشامل")}</h2>
            <p style={{ color: "var(--text-muted)", marginTop: 4 }}>{t("بيانات العيادة ليوم")} {today}</p>
          </div>
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
          }} className="btn-secondary">🖨️ {t("طباعة التقرير الختامي")}</button>
        </div>

        {/* Main Stats Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, marginBottom: 40 }}>
          <FinanceCard 
            title={t("إجمالي المقبوضات")} 
            val={data.stats.total_income} 
            cash={data.stats.cash_income} 
            bank={data.stats.bank_income} 
            icon="💰" color="#10b981" 
          />
          <FinanceCard 
            title={t("إجمالي المصاريف")} 
            val={data.stats.total_expense} 
            cash={data.stats.cash_expense} 
            bank={data.stats.bank_expense} 
            icon="📉" color="#ef4444" 
          />
          <StatCard title={t("صافي الربح اليومي")} value={data.stats.net} icon="🏦" color="#00D2FF" isNet />
          <StatCard title={t("مرضى وحالات اليوم")} value={`${data.stats.patients_treated} ${t("معالج")} / ${data.stats.new_patients_count} ${t("جدد")}`} icon="👥" color="#8b5cf6" noCurrency />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(450px, 1fr))", gap: 32 }}>
          <div className="glass-panel" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>💸 {t("تفاصيل التدفق المالي")}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {data.invoices.length === 0 && data.expenses.length === 0 ? <EmptyState msg={t("لا توجد حركات مالية اليوم")} /> : (
                <>
                  {data.invoices.map(inv => (
                    <div key={`inv-${inv.id}`} style={itemStyle}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{inv.patient_name}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{inv.payment_method === 'Cash' ? '💵 Cash' : '🏦 Bank'}</div>
                      </div>
                      <div style={{ color: "#10b981", fontWeight: 800 }}>+{fmt(inv.paid)} {t("د")}</div>
                    </div>
                  ))}
                  {data.expenses.map(exp => (
                    <div key={`exp-${exp.id}`} style={itemStyle}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{exp.category}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{exp.payment_method === 'Cash' ? '💵 Cash' : '🏦 Bank'} · {exp.notes}</div>
                      </div>
                      <div style={{ color: "#ef4444", fontWeight: 800 }}>-{fmt(exp.amount)} {t("د")}</div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          <div className="glass-panel" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>🦷 {t("السجل الطبي السريع (الإجراءات)")}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
               {data.treatments.length === 0 ? <EmptyState msg={t("لم يتم تسجيل إجراءات طبية اليوم")} /> : 
                 data.treatments.map(t => (
                   <div key={t.id} style={itemStyle}>
                      <div>
                         <div style={{ fontWeight: 700 }}>{t.patient_name}</div>
                         <div style={{ fontSize: 12, color: "var(--primary)", fontWeight: 600 }}>{t.procedure} {t.tooth_number ? `(${t.tooth_number})` : ""}</div>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{t.notes || "—"}</div>
                   </div>
                 ))
               }
            </div>
          </div>

          <div className="glass-panel" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>📦 {t("استهلاك المخزن اليومي")}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
               {data.inventory_logs.length === 0 ? <EmptyState msg={t("لم يتم تسجيل استهلاك مواد اليوم")} /> : 
                 data.inventory_logs.map(log => (
                   <div key={log.id} style={itemStyle}>
                      <div style={{ fontWeight: 700 }}>{log.target_name}</div>
                      <div style={{ color: "#ef4444", fontWeight: 700 }}>{log.description.split('بـ')[1] || "تم الاستهلاك"}</div>
                   </div>
                 ))
               }
            </div>
          </div>

          <div className="glass-panel" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>📅 {t("حالة مواعيد اليوم")}</h3>
            <div style={{ display: "flex", gap: 20, marginBottom: 20 }}>
               <div style={{ flex: 1, textAlign: "center", padding: 12, background: "rgba(16,185,129,0.1)", borderRadius: 12 }}>
                  <div style={{ fontSize: 11, color: "#10b981", fontWeight: 700 }}>{t("اكتملت")}</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: "#10b981" }}>{data.stats.apt_completed}</div>
               </div>
               <div style={{ flex: 1, textAlign: "center", padding: 12, background: "rgba(239, 68, 68, 0.1)", borderRadius: 12 }}>
                  <div style={{ fontSize: 11, color: "#ef4444", fontWeight: 700 }}>{t("لم تحضر")}</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: "#ef4444" }}>{data.stats.apt_no_show}</div>
               </div>
            </div>
            <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
               {data.appointments.map(a => (
                 <div key={a.id} style={{ ...itemStyle, padding: "8px 12px", fontSize: 13 }}>
                    <span>{a.patient_name}</span>
                    <span style={{ fontSize: 11, color: a.status === 'completed' || a.status === 'finished' ? '#10b981' : '#ef4444' }}>{t(a.status)}</span>
                 </div>
               ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Print View (Tables) ── */}
      <div className="print-only">
        <div style={{ textAlign: "center", marginBottom: 40 }}>
           <h1 style={{ margin: 0, fontSize: 24 }}>{t("تقرير الجرد اليومي الختامي")}</h1>
           <p style={{ margin: "5px 0" }}>{t("بيانات العيادة ليوم")}: {today}</p>
           <hr />
        </div>

        {/* 1. Financial Table */}
        <section style={{ marginBottom: 30 }}>
          <h3 style={{ borderBottom: "2px solid black", paddingBottom: 5 }}>💰 {t("الخلاصة المالية")}</h3>
          <table className="print-table">
             <thead>
                <tr>
                   <th>{t("البيان")}</th>
                   <th>{t("المبلغ (د)")}</th>
                   <th>{t("كاش")}</th>
                   <th>{t("بنك")}</th>
                </tr>
             </thead>
             <tbody>
                <tr>
                   <td>{t("إجمالي المقبوضات")}</td>
                   <td>{fmt(data.stats.total_income)}</td>
                   <td>{fmt(data.stats.cash_income)}</td>
                   <td>{fmt(data.stats.bank_income)}</td>
                </tr>
                <tr>
                   <td>{t("إجمالي المصاريف")}</td>
                   <td>{fmt(data.stats.total_expense)}</td>
                   <td>{fmt(data.stats.cash_expense)}</td>
                   <td>{fmt(data.stats.bank_expense)}</td>
                </tr>
                <tr style={{ fontWeight: 800 }}>
                   <td>{t("صافي الربح")}</td>
                   <td colSpan="3">{fmt(data.stats.net)} {t("د")}</td>
                </tr>
             </tbody>
          </table>
        </section>

        {/* 2. Treatments Table */}
        <section style={{ marginBottom: 30 }}>
          <h3 style={{ borderBottom: "2px solid black", paddingBottom: 5 }}>🦷 {t("السجل الطبي والإجراءات")}</h3>
          <table className="print-table">
             <thead>
                <tr>
                   <th style={{ width: "30%" }}>{t("اسم المريض")}</th>
                   <th style={{ width: "40%" }}>{t("الإجراء")}</th>
                   <th>{t("ملاحظات")}</th>
                </tr>
             </thead>
             <tbody>
                {data.treatments.map(t => (
                  <tr key={t.id}>
                     <td>{t.patient_name}</td>
                     <td>{t.procedure} {t.tooth_number ? `(${t.tooth_number})` : ""}</td>
                     <td>{t.notes || "—"}</td>
                  </tr>
                ))}
                {data.treatments.length === 0 && <tr><td colSpan="3" style={{ textAlign: "center" }}>{t("لا توجد إجراءات مسجلة")}</td></tr>}
             </tbody>
          </table>
        </section>

        {/* 3. Inventory Consumption Table */}
        <section style={{ marginBottom: 30 }}>
          <h3 style={{ borderBottom: "2px solid black", paddingBottom: 5 }}>📦 {t("استهلاك المخزن")}</h3>
          <table className="print-table">
             <thead>
                <tr>
                   <th>{t("المادة")}</th>
                   <th>{t("الكمية المستهلكة")}</th>
                </tr>
             </thead>
             <tbody>
                {data.inventory_logs.map(log => (
                  <tr key={log.id}>
                     <td>{log.target_name}</td>
                     <td>{log.description.split('بـ')[1] || "—"}</td>
                  </tr>
                ))}
                {data.inventory_logs.length === 0 && <tr><td colSpan="2" style={{ textAlign: "center" }}>{t("لا يوجد استهلاك مواد")}</td></tr>}
             </tbody>
          </table>
        </section>

        <div style={{ marginTop: 60, display: "flex", justifyContent: "space-between", padding: "0 40px" }}>
           <div>{t("توقيع السكرتارية")}: ________________</div>
           <div>{t("توقيع الطبيب")}: ________________</div>
        </div>
      </div>

    </div>
  );
}

function FinanceCard({ title, val, cash, bank, icon, color }) {
  const { t } = useLanguage();
  return (
    <div className="glass-panel" style={{ padding: 24, position: "relative" }}>
      <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 700, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color, marginBottom: 12 }}>{fmt(val)} <span style={{ fontSize: 14 }}>{t("د")}</span></div>
      <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
         <div style={{ color: "var(--text-muted)" }}>💵 {t("نقداً")}: <span style={{ color: "white", fontWeight: 700 }}>{fmt(cash)}</span></div>
         <div style={{ color: "var(--text-muted)" }}>🏦 {t("بنك")}: <span style={{ color: "white", fontWeight: 700 }}>{fmt(bank)}</span></div>
      </div>
      <div style={{ position: "absolute", top: 16, right: 16, fontSize: 24, opacity: 0.2 }}>{icon}</div>
    </div>
  );
}

function StatCard({ title, value, icon, color, isNet, noCurrency }) {
  const { t } = useLanguage();
  return (
    <div className="glass-panel" style={{ padding: 24, position: "relative", overflow: "hidden" }}>
      <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600, marginBottom: 8 }}>{title}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <div style={{ fontSize: 24, fontWeight: 900, color: isNet && value < 0 ? "#ef4444" : color }}>
          {typeof value === 'number' ? fmt(value) : value} 
        </div>
        {!noCurrency && <span style={{ fontSize: 12, opacity: 0.7 }}>{t("د")}</span>}
      </div>
      <div style={{ position: "absolute", right: -10, bottom: -10, fontSize: 60, opacity: 0.05 }}>{icon}</div>
    </div>
  );
}

function EmptyState({ msg }) {
  return <div style={{ textAlign: "center", padding: "20px 0", opacity: 0.4, fontSize: 13 }}>{msg}</div>;
}

const itemStyle = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
  padding: "12px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.05)"
};

const printStyles = `
  @media screen {
    .print-only { display: none; }
  }
  @media print {
    @page { margin: 15mm; }
    body { 
        background: white !important; 
        color: black !important; 
        font-family: Arial, sans-serif !important;
        margin: 0 !important;
        padding: 0 !important;
    }
    .no-print { display: none !important; }
    .print-only { 
        display: block !important; 
        width: 100% !important;
        background: white !important;
        color: black !important;
    }
    
    .print-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 15px;
        background: white !important;
    }
    .print-table th, .print-table td {
        border: 1pt solid #000 !important;
        padding: 10px;
        text-align: right;
        font-size: 14px;
        color: black !important;
        background: white !important;
    }
    .print-table th {
        background-color: #f0f0f0 !important;
        font-weight: bold !important;
        -webkit-print-color-adjust: exact;
    }
    h1, h2, h3 { 
        color: black !important; 
        background: none !important;
        margin-bottom: 10px !important;
    }
    hr { border: 0.5pt solid black !important; }
    section { page-break-inside: avoid; margin-bottom: 40px !important; }
    * { 
        box-shadow: none !important; 
        text-shadow: none !important; 
        background: transparent !important;
        -webkit-print-color-adjust: exact !important; 
        print-color-adjust: exact !important; 
    }
    .print-only, .print-only * { background: white !important; color: black !important; }
  }
`;

const StyleTag = () => <style>{printStyles}</style>;
