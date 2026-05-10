import { useEffect, useState } from "react";
import { useLanguage } from "../LanguageContext";
import { useAuth } from "../AuthContext";
import { getFinancialStats, getStats } from "../api";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const SummaryCard = ({ label, val, color }) => {
  const { t } = useLanguage();
  return (
    <div className="glass-panel" style={{ padding: 16, textAlign: "center", borderTop: `4px solid ${color}`, display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700 }}>{val?.toLocaleString()} {t("د")}</div>
    </div>
  );
};

const ReportRow = ({ label, val, unit, color, bold }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
    <span style={{ fontSize: 14, color: "var(--text-muted)" }}>{label}</span>
    <span style={{ fontSize: bold ? 20 : 16, fontWeight: 700, color: color || "white" }}>{val?.toLocaleString()} {unit}</span>
  </div>
);

export default function Reports() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const isSecretary = user?.role === "secretary";
  const [fin, setFin] = useState({});
  const [stats, setStats] = useState({});

  useEffect(() => {
    getFinancialStats().then(setFin).catch(console.error);
    getStats().then(setStats).catch(console.error);
  }, []);

  return (
    <div className="animate-fade">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>{t("التقارير والإحصائيات")}</h2>
      </div>

      <div className="summary-grid">
        <SummaryCard label={t("إيرادات اليوم")} val={fin.collected_today} color="#10b981" />
        <SummaryCard label={t("صرفيات اليوم")} val={fin.expenses_today} color="#ef4444" />
        {!isSecretary && (
          <>
            <SummaryCard label={t("إيرادات الشهر")} val={fin.collected_month} color="#185FA5" />
            <SummaryCard label={t("إجمالي الكاش (Cash)")} val={fin.cash_revenue} color="#f59e0b" />
            <SummaryCard label={t("إجمالي البنك (Bank)")} val={fin.bank_revenue} color="#00D2FF" />
          </>
        )}
      </div>

      <style>{`
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 12px; margin-bottom: 24px; }
        .reports-main-grid { display: grid; grid-template-columns: 1.5fr 1fr; gap: 24px; margin-bottom: 24px; }
        .reports-main-grid.is-secretary { grid-template-columns: 1fr; }
        
        .mobile-mode .summary-grid { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)) !important; }
        .mobile-mode .reports-main-grid { grid-template-columns: 1fr !important; gap: 16px !important; }
      `}</style>

      <div className={`reports-main-grid ${isSecretary ? "is-secretary" : ""}`}>
        {/* Main Financial Report */}
        <div className="glass-panel" style={{ padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <h3 style={{ fontSize: 18, fontWeight: 600 }}>🏦 {isSecretary ? t("التقرير المالي لليوم") : t("التقرير المالي العام")}</h3>
            {!isSecretary && (
              <div style={{ fontSize: 12, background: "rgba(16, 185, 129, 0.1)", color: "#10b981", padding: "4px 12px", borderRadius: 20 }}>
                Collection Rate: {fin.collection_rate}%
              </div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
             <ReportRow label={t("إيرادات اليوم")} val={fin.collected_today} unit={t("د")} />
             <ReportRow label={t("صرفيات اليوم")} val={fin.expenses_today} unit={t("د")} />
             {!isSecretary && (
               <>
                 <ReportRow label={t("إجمالي المقبوضات (All Time)")} val={fin.revenue} unit={t("د")} />
                 <ReportRow label={t("إجمالي المصاريف (All Time)")} val={fin.expenses} unit={t("د")} />
               </>
             )}
             <div style={{ height: 1, background: "rgba(255,255,255,0.1)" }} />
             <ReportRow label={isSecretary ? t("صافي ربح اليوم") : t("صافي الربح")} val={isSecretary ? (fin.collected_today - fin.expenses_today) : fin.net_profit} unit={t("د")} color="#10b981" bold />
          </div>
        </div>

        {/* Debts Summary */}
        <div className="glass-panel" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>⚠️ {t("مديونية المرضى")}</h3>
          <div style={{ textAlign: "center", padding: "20px 0" }}>
             <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>{t("إجمالي الديون المتبقية عند المرضى")}</div>
             <div style={{ fontSize: 32, fontWeight: 800, color: "#ef4444" }}>{fin.total_debt?.toLocaleString()} {t("د")}</div>
             <button className="btn-ghost" style={{ marginTop: 20, width: "100%" }} onClick={() => window.location.href = "/debts"}>{t("عرض تفاصيل المدينين")}</button>
          </div>
        </div>
      </div>

      {!isSecretary && (
        <div className="glass-panel" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>📈 {t("النمو الشهري")}</h3>
          <div style={{ height: 250, width: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={fin.monthly_growth || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00D2FF" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#185FA5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: "rgba(15,23,42,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "white" }} />
                <Area type="monotone" dataKey="revenue" name={t("الإيرادات")} stroke="#00D2FF" fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}


