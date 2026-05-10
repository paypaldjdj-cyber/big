import { useEffect, useState } from "react";
import { useLanguage } from "../LanguageContext";
import { getDebts } from "../api";
import { useNavigate } from "react-router-dom";

export default function Debts() {
  const { t } = useLanguage();
  const [list, setList] = useState([]);
  const nav = useNavigate();

  useEffect(() => {
    getDebts().then(setList).catch(console.error);
  }, []);

  const totalDebt = list.reduce((s, x) => s + x.debt, 0);

  return (
    <div className="animate-fade">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>{t("قائمة المديونيات")}</h2>
        <div className="glass-panel" style={{ padding: "12px 24px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
          <span style={{ fontSize: 13, color: "var(--text-muted)", marginLeft: 8 }}>{t("إجمالي الديون المستحقة")}:</span>
          <span style={{ fontSize: 20, fontWeight: 800, color: "var(--danger)" }}>{(totalDebt || 0).toLocaleString()} {t("د")}</span>
        </div>
      </div>

      <div className="glass-panel">
        <div className="table-container">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                {[t("المريض"), t("الهاتف"), t("إجمالي العلاج"), t("المدفوع"), t("المبلغ المتبقي"), t("إجراء")].map(h => (
                  <th key={h} style={{ padding: "16px 20px", textAlign: "right", fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map(x => (
                <tr key={x.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <td style={{ padding: "14px 20px", fontWeight: 600 }}>{x.first_name} {x.last_name}</td>
                  <td style={{ padding: "14px 20px", fontSize: 13, color: "var(--text-muted)" }}>{x.phone || "—"}</td>
                  <td style={{ padding: "14px 20px", fontSize: 13 }}>{(x.total_amt || 0).toLocaleString()} {t("د")}</td>
                  <td style={{ padding: "14px 20px", fontSize: 13, color: "var(--success)" }}>{(x.total_paid || 0).toLocaleString()} {t("د")}</td>
                  <td style={{ padding: "14px 20px", fontSize: 13, fontWeight: 700, color: "var(--danger)" }}>{(x.debt || 0).toLocaleString()} {t("د")}</td>
                  <td style={{ padding: "14px 20px" }}>
                    <button onClick={() => nav(`/patients/${x.id}`)} className="btn-ghost" style={{ padding: "6px 12px", fontSize: 11 }}>{t("ملف المريض")}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {list.length === 0 && (
          <div style={{ padding: 60, textAlign: "center", color: "var(--text-muted)" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            {t("لا توجد ديون مستحقة ✓")}
          </div>
        )}
      </div>
    </div>
  );
}
