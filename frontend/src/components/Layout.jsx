import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { useLanguage } from "../LanguageContext";
import { useAuth } from "../AuthContext";
import { useSettings } from "../SettingsContext";
import { BASE } from "../api";

const links = [
  { to: "/", label: "الرئيسية", icon: "🏠", mobile: true },
  { to: "/patients", label: "المرضى", icon: "👥", mobile: true },
  { to: "/appointments", label: "المواعيد", icon: "📅", mobile: true },
  { to: "/invoices", label: "الفواتير", icon: "💰", mobile: true },
  { to: "/reports", label: "التقارير", icon: "📈" },
  { to: "/prescriptions", label: "الوصفات", icon: "📝" },
  { to: "/drugs", label: "الأدوية", icon: "💊" },
  { to: "/expenses", label: "المصاريف", icon: "📉" },
  { to: "/inventory", label: "المخزن", icon: "📦" },
  { to: "/settings", label: "الإعدادات", icon: "⚙️" },
  { to: "/admin", label: "إدارة النظام", icon: "🛡️", adminOnly: true },
];

export default function Layout({ children }) {
  const { t, toggleLanguage, lang } = useLanguage();
  const { logout, user } = useAuth();
  const { settings } = useSettings();
  const [showMore, setShowMore] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const handleToast = (e) => {
      setToast(e.detail);
      setTimeout(() => setToast(null), 3000);
    };
    window.addEventListener('show-toast', handleToast);
    return () => window.removeEventListener('show-toast', handleToast);
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const today = new Date().toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", {
    weekday: "short", day: "numeric", month: "short"
  });

  const filteredLinks = links.filter(l => {
    if (l.adminOnly && user?.role !== "admin") return false;
    if (user?.role === "secretary") {
      const restricted = ["التقارير", "الأدوية"];
      if (restricted.includes(l.label)) return false;
    }
    return true;
  });

  const mobilePrimaryLinks = filteredLinks.filter(l => l.mobile);
  const mobileSecondaryLinks = filteredLinks.filter(l => !l.mobile);

  return (
    <div
      className={isMobile ? "mobile-mode" : ""}
      style={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        minHeight: "100vh",
        direction: lang === "ar" ? "rtl" : "ltr"
      }}
    >
      {/* ── Sidebar (Desktop only) ── */}
      {!isMobile && (
        <aside className="glass-panel desktop-nav no-print">
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 40, padding: "0 10px" }}>
            {settings?.clinic_logo ? (
              <img src={BASE + settings.clinic_logo} alt="Logo" style={{ width: 40, height: 40, borderRadius: 12, objectFit: "cover" }} />
            ) : (
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: "linear-gradient(135deg, #185FA5, #00D2FF)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20
              }}>🦷</div>
            )}
            <div style={{ fontWeight: 700, fontSize: 18, letterSpacing: -0.5 }}>
              {settings?.clinic_name || t("SmileCare")}
            </div>
          </div>

          <nav className="custom-scrollbar" style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, width: "100%", overflowY: "auto", paddingRight: 4 }}>
            {filteredLinks.map(l => (
              <NavLink key={l.to} to={l.to} end={l.to === "/"}
                className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
                style={{ padding: "10px 16px" }}
              >
                <span style={{ fontSize: 18 }}>{l.icon}</span>
                {t(l.label)}
              </NavLink>
            ))}
          </nav>
        </aside>
      )}

      {/* ── Main content ── */}
      <main style={{
        flex: 1,
        overflowY: "auto",
        width: "100%",
        padding: isMobile ? 0 : "24px 32px 24px 16px",
        display: isMobile ? "flex" : "block",
        justifyContent: "center",
        background: isMobile && window.innerWidth >= 600 ? "#050810" : "transparent"
      }}>
        <div style={{
          width: "100%",
          maxWidth: isMobile ? "430px" : "100%",
          background: "var(--bg-dark)",
          minHeight: "100vh",
          position: "relative",
          padding: isMobile
            ? "20px 14px calc(90px + env(safe-area-inset-bottom, 16px)) 14px"
            : 0,
          margin: "0 auto",
          boxShadow: isMobile && window.innerWidth >= 600 ? "0 0 50px rgba(0,0,0,0.5)" : "none",
          borderLeft: isMobile && window.innerWidth >= 600 ? "1px solid rgba(255,255,255,0.05)" : "none",
          borderRight: isMobile && window.innerWidth >= 600 ? "1px solid rgba(255,255,255,0.05)" : "none",
        }}>

          {/* Top Header */}
          <header className="no-print" style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            marginBottom: isMobile ? 20 : 32, padding: "0 4px"
          }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 3 }}>{today}</div>
              <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, lineHeight: 1.3, margin: 0 }}>
                {isMobile
                  ? (settings?.clinic_name || t("عيادة سمايل كير"))
                  : `${t("أهلاً بك")}، ${user?.role === "admin" ? "مدير النظام" : (user?.role === "secretary" ? t("سكرتيرة العيادة") : (settings?.doctor_name || t("دكتور")))}`
                }
              </h1>
            </div>

            {/* Global Search */}
            <div className="desktop-only" style={{ flex: 1, minWidth: 200, display: "flex", justifyContent: "center" }}>
               <div style={{ position: "relative", width: "100%", maxWidth: 300 }}>
                 <input type="text" placeholder={t("بحث عام عن مريض...")} className="glass-input" 
                  style={{ width: "100%", padding: "8px 16px", paddingLeft: 36, borderRadius: 20 }}
                  onKeyDown={(e) => { 
                    if (e.key === 'Enter') window.location.href = `/patients?q=${encodeURIComponent(e.target.value)}`; 
                  }}
                 />
                 <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", opacity: 0.5 }}>🔍</span>
               </div>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
              <button onClick={toggleLanguage} className="glass-panel" style={{
                fontSize: 12, fontWeight: 600, height: 34, padding: "0 12px",
                borderRadius: 10, display: "flex", alignItems: "center",
                border: "1px solid rgba(255,255,255,0.1)", background: "transparent", cursor: "pointer"
              }}>
                {lang === "ar" ? "EN" : "AR"}
              </button>

              {/* Toggle button — desktop only */}
              {!isMobile && (
                <button onClick={() => setIsMobile(true)} className="glass-panel" style={{
                  width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.05)", color: "white",
                  cursor: "pointer", borderRadius: 10
                }}>📱</button>
              )}

              <button onClick={logout} className="glass-panel" style={{
                width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 15, border: "1px solid rgba(239,68,68,0.2)",
                background: "rgba(239,68,68,0.05)", cursor: "pointer", borderRadius: 10
              }}>🚪</button>
            </div>
          </header>

          <div className="animate-fade">{children}</div>

          {toast && (
            <div className="animate-fade" style={{
              position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
              padding: "12px 24px", borderRadius: 12, zIndex: 10000,
              background: toast.type === 'error' ? 'var(--danger)' : 'var(--success)',
              color: 'white', fontWeight: 600, boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
              display: "flex", alignItems: "center", gap: 10
            }}>
              <span style={{ fontSize: 18 }}>{toast.type === 'error' ? '⚠️' : '✅'}</span>
              <span>{toast.message}</span>
            </div>
          )}
        </div>
      </main>

      {/* ── Bottom Nav (Mobile only) ── */}
      {isMobile && (
        <>
          {showMore && (
            <div className="animate-fade" style={{
              position: "fixed", bottom: 84,
              left: "50%", transform: "translateX(-50%)",
              width: "calc(100% - 24px)", maxWidth: 406, zIndex: 10000
            }}>
              <div className="glass-panel" style={{
                padding: 12, display: "grid", gridTemplateColumns: "1fr 1fr",
                gap: 8, boxShadow: "0 10px 40px rgba(0,0,0,0.4)"
              }}>
                {mobileSecondaryLinks.map(l => (
                  <NavLink key={l.to} to={l.to} onClick={() => setShowMore(false)}
                    className="nav-link" style={{
                      background: "rgba(255,255,255,0.05)", padding: 14,
                      borderRadius: 12, flexDirection: "row",
                      justifyContent: "flex-start", gap: 10
                    }}>
                    <span style={{ fontSize: 18 }}>{l.icon}</span>
                    <span style={{ fontSize: 13 }}>{t(l.label)}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          )}

          <nav className="mobile-nav no-print">
            {mobilePrimaryLinks.map(l => (
              <NavLink key={l.to} to={l.to} end={l.to === "/"} onClick={() => setShowMore(false)}
                className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
                <span>{l.icon}</span>
                <span>{t(l.label)}</span>
              </NavLink>
            ))}
            <button
              onClick={() => setShowMore(!showMore)}
              className={showMore ? "nav-link active" : "nav-link"}
              style={{ background: "transparent", border: "none", cursor: "pointer", flex: 1 }}
            >
              <span style={{ fontSize: 24, color: "#8B5CF6", fontWeight: 300 }}>{showMore ? "✕" : "+"}</span>
              <span>{t("المزيد")}</span>
            </button>
          </nav>
        </>
      )}

      <style>{`
        .desktop-nav {
          width: 260px;
          margin: 16px;
          display: flex;
          flex-direction: column;
          padding: 24px;
          position: sticky;
          top: 16px;
          height: calc(100vh - 32px);
          flex-shrink: 0;
          overflow: hidden;
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }

        .mobile-nav {
          position: fixed;
          bottom: 12px;
          left: 50%;
          transform: translateX(-50%);
          width: calc(100% - 24px);
          max-width: 406px;
          height: 64px;
          display: flex;
          align-items: center;
          padding: 0 4px;
          z-index: 9999;
          border-radius: 20px;
          background: rgba(15, 23, 42, 0.92);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255,255,255,0.1);
          box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        }
        .nav-link {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border-radius: 12px;
          color: var(--text-muted);
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
        }
        .nav-link:hover { background: rgba(255,255,255,0.05); color: var(--text-main); }
        .nav-link.active { background: var(--primary); color: white; box-shadow: 0 4px 12px rgba(24,95,165,0.3); }

        .mobile-nav .nav-link {
          flex-direction: column;
          gap: 3px;
          padding: 6px 0;
          flex: 1;
          justify-content: center;
          background: transparent !important;
          box-shadow: none !important;
          border-radius: 0;
          font-size: 9px;
          min-height: 44px;
        }
        .mobile-nav .nav-link span:first-child { font-size: 20px; }
        .mobile-nav .nav-link.active { color: var(--accent); }
        .mobile-nav .nav-link.active span:first-child {
          transform: translateY(-2px);
          text-shadow: 0 0 10px rgba(0,210,255,0.5);
        }
      `}</style>
    </div>
  );
}
