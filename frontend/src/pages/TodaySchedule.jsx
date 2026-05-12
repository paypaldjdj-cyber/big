import React, { useEffect, useState } from "react";
import { getAppointments } from "../api";
import { useLanguage } from "../LanguageContext";
import { useNavigate } from "react-router-dom";
import { useSettings } from "../SettingsContext";

export default function TodaySchedule() {
  const { t, lang } = useLanguage();
  const nav = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [hiddenIds, setHiddenIds] = useState(() => {
    const saved = sessionStorage.getItem('today_hidden_ids');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const STATUS_ORDER = ["booked", "waiting", "treating", "finished", "postponed", "absent"];
  const STATUS_CONFIG = {
    "booked":    { ar: "محجوز", icon: "📅", color: "#185FA5", bg: "rgba(24, 95, 165, 0.15)" },
    "waiting":   { ar: "في الانتظار", icon: "⏳", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.15)" },
    "treating":  { ar: "قيد المعالجة", icon: "🦷", color: "#10b981", bg: "rgba(16, 185, 129, 0.15)" },
    "finished":  { ar: "منتهي", icon: "✅", color: "#065f46", bg: "rgba(6, 95, 70, 0.15)" },
    "postponed": { ar: "مؤجل", icon: "🕒", color: "#7c3aed", bg: "rgba(124, 58, 237, 0.15)" },
    "absent":    { ar: "غائب", icon: "❌", color: "#ef4444", bg: "rgba(239, 68, 68, 0.15)" },
  };

  const getLocalDate = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };

  const todayStr = getLocalDate();

  const mapStatus = (s) => {
    if (s === "قادم" || s === "محجوز") return "booked";
    if (s === "في الانتظار") return "waiting";
    if (s === "قيد المعالجة") return "treating";
    if (s === "منتهي") return "finished";
    if (s === "مؤجل") return "postponed";
    if (s === "غائب") return "absent";
    return s;
  };

  const load = () => {
    setLoading(true);
    getAppointments(todayStr).then(data => {
      if (Array.isArray(data)) {
        const mapped = data.map(app => ({ ...app, status: mapStatus(app.status) }));
        setAppointments(mapped.sort((a, b) => a.time.localeCompare(b.time)));
      }
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const cycleStatus = async (id, current) => {
    // Map legacy Arabic values to keys
    let currentKey = current;
    if (current === "قادم" || current === "محجوز") currentKey = "booked";
    if (current === "في الانتظار") currentKey = "waiting";
    if (current === "قيد المعالجة") currentKey = "treating";
    if (current === "منتهي") currentKey = "finished";
    if (current === "مؤجل") currentKey = "postponed";
    if (current === "غائب") currentKey = "absent";

    const idx = STATUS_ORDER.indexOf(currentKey);
    const next = STATUS_ORDER[idx === -1 ? 0 : (idx + 1) % STATUS_ORDER.length];
    
    // UI Optimistic Update: Change status locally first
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: next } : a));

    try {
      const { updateAppointment } = await import("../api");
      await updateAppointment(id, { status: next });
      // Reload from server to be sure
      load();
    } catch (e) {
      console.error("Failed to update status:", e);
      // Revert if failed
      load();
    }
  };

  const { settings } = useSettings();

  const sendWhatsApp = (app) => {
    const cleanPhone = app.patient_phone.replace(/[^0-9]/g, '');
    const finalPhone = cleanPhone.startsWith('0') ? '964' + cleanPhone.substring(1) : cleanPhone.startsWith('964') ? cleanPhone : '964' + cleanPhone;
    
    const defaultBooking = "أهلاً {patient}، تم حجز موعدك في عيادتنا بتاريخ {date} الساعة {time}. ننتظر زيارتك.";
    const defaultReminder = "تذكير: موعدك اليوم في الساعة {time}. يرجى الحضور قبل الموعد بـ 5 دقائق. عيادة الدكتور.";
    const defaultFollowup = "أهلاً {patient}، نود الاطمئنان على صحتك بعد زيارتك للعيادة. هل تشعر بأي ألم؟";

    let template = settings.whatsapp_template_reminder || defaultReminder;
    if (app.status === 'booked') template = settings.whatsapp_template_booking || defaultBooking;
    if (app.status === 'finished') template = settings.whatsapp_template_followup || defaultFollowup;

    let message = template
      .replace(/{patient}/g, app.patient_name || "")
      .replace(/{date}/g, app.date || todayStr)
      .replace(/{time}/g, app.time || "");

    if (!finalPhone || finalPhone === '964') {
      alert(t("رقم الهاتف غير صحيح أو مفقود"));
      return;
    }

    const url = `https://api.whatsapp.com/send?phone=${finalPhone}&text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="animate-fade" style={{ direction: "rtl", textAlign: "right", padding: isMobile ? "0 10px 40px 10px" : "0 20px" }}>
      <div style={{ 
        display: "flex", 
        flexDirection: isMobile ? "column" : "row",
        justifyContent: "space-between", 
        alignItems: isMobile ? "flex-start" : "center", 
        marginBottom: 32,
        gap: 16
      }}>
        <button onClick={() => nav("/appointments")} className="btn-secondary" style={{ width: isMobile ? "100%" : "auto" }}>
          ⬅️ {t("العودة للمواعيد")}
        </button>
        <div style={{ textAlign: isMobile ? "right" : "left", width: isMobile ? "100%" : "auto" }}>
          <h1 style={{ fontSize: isMobile ? 24 : 32, fontWeight: 800, margin: 0 }}>📋 {t("جدول مواعيد اليوم")}</h1>
          <p style={{ color: "var(--text-muted)", marginTop: 8, fontSize: 16 }}>
            {new Date().toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 100, fontSize: 24 }}>{t("جاري التحميل...")}</div>
      ) : appointments.length === 0 ? (
        <div className="glass-panel" style={{ padding: 100, textAlign: "center", fontSize: 22, color: "var(--text-muted)" }}>
          📭 {t("لا توجد مواعيد مسجلة لهذا اليوم")}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {appointments.filter(app => !hiddenIds.includes(app.id)).map((app, index) => {
            const isNext = index === 0 && app.status === "booked";
            return (
               <div key={app.id} 
                onClick={() => nav(`/patients/${app.patient_id}`)}
                className="glass-panel animate-fade" 
                style={{ 
                  padding: isMobile ? 16 : 24, 
                  display: "flex", 
                  flexDirection: isMobile ? "column" : "row",
                  alignItems: isMobile ? "stretch" : "center", 
                  gap: isMobile ? 12 : 24,
                  cursor: "pointer",
                  borderRight: isNext ? "8px solid var(--primary)" : `6px solid ${(STATUS_CONFIG[app.status] || STATUS_CONFIG["booked"]).color}`,
                  background: isNext ? "rgba(24, 95, 165, 0.1)" : "linear-gradient(90deg, rgba(255,255,255,0.03) 0%, transparent 100%)",
                  transition: "all 0.3s"
                }}
              >
                <div style={{ 
                  fontSize: isMobile ? 24 : 32, 
                  fontWeight: 900, 
                  minWidth: isMobile ? "auto" : 120, 
                  color: "var(--primary)",
                  textAlign: "center",
                  background: "rgba(24, 95, 165, 0.15)",
                  padding: isMobile ? "10px" : "15px 25px",
                  borderRadius: 16
                }}>
                  {app.time}
                  <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", marginTop: 4 }}>{t("التوقيت")}</div>
                </div>
 
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
                    <h2 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 800, margin: 0 }}>{app.patient_name}</h2>
                    {isNext && <span style={{ background: "var(--primary)", color: "white", padding: "2px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{t("المريض التالي")}</span>}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12, color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>
                    <span>🦷 {t(app.type) || t("فحص عام")}</span>
                    <span>⏳ {app.duration_min} {t("دقيقة")}</span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: isMobile ? "space-between" : "flex-end" }}>
                   <div style={{ display: "flex", gap: 8 }}>
                     {app.status === "treating" && (
                       <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          nav(`/patients/${app.patient_id}?action=start-session`);
                        }}
                        className="animate-pulse"
                        style={{ 
                          padding: "8px 16px", borderRadius: 12, fontSize: 13, fontWeight: 800,
                          background: "var(--primary)", color: "white", border: "none", cursor: "pointer",
                          display: "flex", alignItems: "center", gap: 6, boxShadow: "0 0 15px rgba(0, 210, 255, 0.4)"
                        }}
                       >
                         <span>🦷</span> <span>{t("بدأ جلسة")}</span>
                       </button>
                     )}

                     <button 
                      onClick={(e) => { e.stopPropagation(); cycleStatus(app.id, app.status); }}
                      style={{ 
                        padding: isMobile ? "8px 12px" : "10px 20px", borderRadius: 12, fontSize: 13, fontWeight: 700,
                        background: (STATUS_CONFIG[app.status] || STATUS_CONFIG["booked"]).bg,
                        color: (STATUS_CONFIG[app.status] || STATUS_CONFIG["booked"]).color,
                        border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6
                      }}
                     >
                       <span>{(STATUS_CONFIG[app.status] || STATUS_CONFIG["booked"]).icon}</span>
                       <span>{t((STATUS_CONFIG[app.status] || STATUS_CONFIG["booked"]).ar)}</span>
                     </button>
                   </div>
                   
                   <div style={{ display: "flex", gap: 8 }}>
                      {["finished", "postponed", "absent"].includes(app.status) && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            const newHidden = [...hiddenIds, app.id];
                            setHiddenIds(newHidden);
                            sessionStorage.setItem('today_hidden_ids', JSON.stringify(newHidden));
                          }}
                          className="btn-ghost"
                          style={{ 
                            width: 38, height: 38, borderRadius: 10, border: "none", 
                            background: "rgba(16, 185, 129, 0.1)", color: "#10b981", 
                            fontSize: 18, cursor: "pointer"
                          }}
                          title={t("إخفاء")}
                        >
                          ✔️
                        </button>
                      )}

                     {app.patient_phone && (
                       <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
                         <a href={`tel:${app.patient_phone}`} style={{ width: 38, height: 38, borderRadius: 10, fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", background: "rgba(234, 179, 8, 0.1)", color: "#eab308" }}>📞</a>
                         <button 
                           onClick={(e) => { e.preventDefault(); e.stopPropagation(); sendWhatsApp(app); }}
                           style={{ width: 38, height: 38, borderRadius: 10, fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", border: "none", background: "rgba(34, 197, 94, 0.1)", color: "#22c55e", cursor: "pointer" }}
                         >
                           💬
                         </button>
                       </div>
                     )}
                   </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
