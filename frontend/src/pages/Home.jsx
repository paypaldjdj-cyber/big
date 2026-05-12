import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getStats, getAppointments, getFinancialStats, getLowStock } from "../api";
import { useLanguage } from "../LanguageContext";
import { useSettings } from "../SettingsContext";
import { useAuth } from "../AuthContext";

const StatCard = ({ val, lbl, subMobile, subDesktop, color, icon }) => (
  <div className="glass-panel animate-fade stat-card-container">
    <div className="stat-card-top">
      <div className="stat-card-icon" style={{ background: `${color}15`, color }}>
        {icon}
      </div>
      {subDesktop && (
        <div className="stat-card-badge desktop-only" style={{ background: `${color}15`, color }} dir="ltr">
          {subDesktop}
        </div>
      )}
    </div>
    <div className="stat-card-bottom">
      <div className="stat-card-label">{lbl}</div>
      <div className="stat-card-val">{val}</div>
      {subMobile && <div className="stat-card-sub mobile-only" style={{ color: subMobile.includes("د.ع") ? color : "var(--success)" }} dir="ltr">{subMobile}</div>}
    </div>
  </div>
);

export default function Home() {
  const [stats, setStats] = useState({});
  const [fin, setFin] = useState({});
  const [apts, setApts] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const nav = useNavigate();
  const { t } = useLanguage();
  const { settings } = useSettings();

  useEffect(() => {
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    
    getStats().then(res => setStats(res || {})).catch(console.error);
    getAppointments(today).then(res => setApts(res || [])).catch(console.error);
    getFinancialStats().then(res => setFin(res || {})).catch(console.error);
    
    // Fetch low stock items
    getLowStock()
      .then(items => {
        if (Array.isArray(items)) {
          const low = items.filter(i => i.stock <= i.min_stock);
          setLowStockItems(low);
        } else {
          setLowStockItems([]);
        }
      })
      .catch(console.error);
  }, []);


  const { user } = useAuth();
  const isSecretary = user?.role === "secretary";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* ⚠️ Low Stock Alert Panel */}
      {lowStockItems.length > 0 && (
        <div className="glass-panel animate-fade" style={{ 
          background: "linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.05))",
          border: "1px solid rgba(239, 68, 68, 0.3)",
          padding: "16px 24px",
          borderRadius: 20,
          display: "flex",
          flexDirection: "column",
          gap: 12
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
             <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#ef4444", fontWeight: 800, fontSize: 16 }}>
                <span>⚠️</span> {t("تنبيه المخزن: مواد أوشكت على النفاذ")}
             </div>
             <button onClick={() => nav("/inventory")} className="view-all-btn" style={{ fontWeight: 700 }}>{t("اذهب للمخزن")} ←</button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
             {lowStockItems.map(item => (
                <div key={item.id} style={{ 
                  background: "rgba(255,255,255,0.05)", 
                  padding: "6px 12px", 
                  borderRadius: 10, 
                  fontSize: 13, 
                  display: "flex", 
                  alignItems: "center", 
                  gap: 8,
                  border: "1px solid rgba(255,255,255,0.05)"
                }}>
                   <span style={{ fontWeight: 700 }}>{item.name}</span>
                   <span style={{ color: "#ef4444", fontWeight: 800 }}>({item.stock} {item.unit})</span>
                </div>
             ))}
          </div>
        </div>
      )}

      <div className="stats-grid">
        <StatCard icon="📅" color="#185FA5" lbl={t("مواعيد اليوم")} val={stats.total_today || "0"} subMobile="من أمس +2" subDesktop="+12%" />
        <StatCard icon="💰" color="#10b981" lbl={isSecretary ? t("إيرادات اليوم") : t("إجمالي الإيرادات")} val={`${(isSecretary ? (fin.collected_today || 0) : (fin.revenue || 0)).toLocaleString()} ${t("د")}`} subMobile="د.ع" subDesktop="+5.4%" />
        <StatCard icon="💸" color="#ef4444" lbl={isSecretary ? t("صرفيات اليوم") : t("المصاريف")} val={`${(isSecretary ? (fin.expenses_today || 0) : (fin.expenses || 0)).toLocaleString()} ${t("د")}`} subMobile="د.ع" />
        {!isSecretary && <StatCard icon="💎" color="#00D2FF" lbl={t("صافي الربح")} val={`${(fin.net_profit || 0).toLocaleString()} ${t("د")}`} subMobile="د.ع" subDesktop="Stable" />}
      </div>

      <div className="home-main-grid">
        <div className="glass-panel home-section-card">
          <div className="home-section-header">
            <h3 className="section-title">{t("جدول المواعيد الحالية")}</h3>
            <button onClick={() => nav("/appointments")} className="view-all-btn">{t("عرض الكل")}</button>
          </div>
          <div className="apt-list">
            {apts.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>☕</div>
                {t("لا توجد مواعيد متبقية لليوم")}
              </div>
            ) : apts.map((a, i) => (
              <div key={a.id} className="appointment-row" style={{
                display: "flex", alignItems: "center", gap: 12, padding: "14px 0",
                borderBottom: i < apts.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none"
              }}>
                <div style={{
                  fontSize: 11, padding: "4px 10px", borderRadius: 12, fontWeight: 600, flexShrink: 0,
                  background: a.status === "مكتمل" ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.1)",
                  color: a.status === "مكتمل" ? "#10b981" : "#f59e0b"
                }}>{t(a.status)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.patient_name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{t(a.type)}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)", flexShrink: 0, direction: "ltr" }}>{a.time}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="glass-panel home-section-card">
            <div className="home-section-header">
              <h3 className="section-title">{t("الوصول السريع")}</h3>
            </div>
            <div className="quick-grid">
              {!isSecretary && (
                <button onClick={() => nav("/daily-summary")} className="quick-action-btn" style={{ gridColumn: "1/-1", background: "rgba(0, 210, 255, 0.08)", border: "1px solid rgba(0, 210, 255, 0.2)", padding: "20px" }}>
                  <div className="quick-icon-box" style={{ background: "rgba(0, 210, 255, 0.2)", color: "#00D2FF", width: 44, height: 44, fontSize: 22 }}>📊</div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#00D2FF" }}>{t("ملخص الجرد اليومي")}</div>
                    <div style={{ fontSize: 11, color: "rgba(0, 210, 255, 0.6)", marginTop: 2 }}>{t("جرد المقبوضات والمصاريف والحالات اليوم")}</div>
                  </div>
                </button>
              )}
              {[
                { icon: "👤", label: "مريض جديد", path: "/patients", color: "#8B5CF6" },
                { icon: "📅", label: "موعد جديد", path: "/appointments", color: "#00D2FF" },
                { icon: "🧾", label: "فاتورة", path: "/invoices", color: "#10b981" },
                { icon: "📈", label: "التقارير", path: "/reports", color: "#f59e0b" },
              ].map(action => (
                <button key={action.path} onClick={() => nav(action.path)} className="quick-action-btn">
                  <div className="quick-icon-box" style={{ background: `${action.color}18`, color: action.color }}>{action.icon}</div>
                  <span className="quick-label">{t(action.label)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="glass-panel tip-card">
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>💡 {t("نصيحة اليوم")}</div>
            <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6, margin: 0 }}>
              {t("تأكد من مراجعة الحالات الطبية المسجلة للمريض قبل البدء في أي إجراء جراحي اليوم.")}
            </p>
          </div>
        </div>
      </div>

      <style>{`
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }
        .stat-card-container {
          padding: 20px;
          display: flex;
          flex-direction: column;
          border-radius: 20px;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.04);
        }
        .stat-card-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 20px;
        }
        .stat-card-icon {
          width: 40px; height: 40px;
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          font-size: 18px;
        }
        .stat-card-badge {
          padding: 3px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
        }
        .stat-card-label { font-size: 12px; color: var(--text-muted); margin-bottom: 6px; }
        .stat-card-val { font-size: 28px; font-weight: 700; color: white; line-height: 1; }
        .stat-card-sub { font-size: 11px; margin-top: 6px; }

        .home-main-grid {
          display: grid;
          grid-template-columns: 1.6fr 1fr;
          gap: 16px;
          align-items: start;
        }
        .home-section-card {
          padding: 20px;
          border-radius: 18px;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.04);
        }
        .home-section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .section-title { font-size: 16px; font-weight: 700; margin: 0; }
        .view-all-btn {
          font-size: 12px; color: var(--accent);
          background: transparent; border: none; cursor: pointer; padding: 0;
        }

        .quick-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .quick-action-btn {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 14px;
          padding: 16px 12px;
          cursor: pointer;
          display: flex; flex-direction: column; align-items: center; gap: 10px;
          transition: all 0.2s; width: 100%;
        }
        .quick-action-btn:hover { background: rgba(255,255,255,0.05); transform: translateY(-2px); }
        .quick-icon-box {
          width: 40px; height: 40px; border-radius: 12px;
          display: flex; align-items: center; justify-content: center; font-size: 18px;
        }
        .quick-label { font-size: 13px; font-weight: 600; color: white; text-align: center; }

        .tip-card {
          padding: 18px 20px; border-radius: 16px;
          background: linear-gradient(135deg, rgba(24,95,165,0.18), rgba(0,210,255,0.08));
          border: 1px solid rgba(24,95,165,0.2);
        }
        .appointment-row { border-radius: 10px; transition: background 0.15s; }
        .appointment-row:hover { background: rgba(255,255,255,0.04); }

        /* ═══ MOBILE ═══ */
        .mobile-mode .stats-grid {
          grid-template-columns: 1fr 1fr !important;
          gap: 10px;
        }
        .mobile-mode .stat-card-container { padding: 14px; border-radius: 16px; }
        .mobile-mode .stat-card-top { margin-bottom: 10px; }
        .mobile-mode .stat-card-icon { width: 34px; height: 34px; font-size: 16px; border-radius: 10px; }
        .mobile-mode .stat-card-val { font-size: 18px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .mobile-mode .stat-card-label { font-size: 10px; }

        .mobile-mode .home-main-grid { grid-template-columns: 1fr; gap: 12px; }
        .mobile-mode .home-section-card { padding: 14px; border-radius: 16px; }

        .mobile-mode .quick-action-btn {
          flex-direction: row; padding: 12px 14px; gap: 12px; border-radius: 12px; align-items: center;
        }
        .mobile-mode .quick-icon-box { width: 34px; height: 34px; font-size: 16px; border-radius: 10px; flex-shrink: 0; }
        .mobile-mode .quick-label { font-size: 13px; text-align: right; }
        .mobile-mode .tip-card { padding: 14px 16px; border-radius: 14px; }
      `}</style>
    </div>
  );
}
