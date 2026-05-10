import React, { useEffect, useState } from "react";
import { getAppointments } from "../api";
import { useLanguage } from "../LanguageContext";
import { useNavigate } from "react-router-dom";
import { useSettings } from "../SettingsContext";

export default function TodaySchedule() {
  const { t } = useLanguage();
  const nav = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hiddenIds, setHiddenIds] = useState(() => {
    const saved = sessionStorage.getItem('today_hidden_ids');
    return saved ? JSON.parse(saved) : [];
  });

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

  const today = getLocalDate();

  const load = () => {
    setLoading(true);
    getAppointments(today).then(data => {
      if (Array.isArray(data)) {
        setAppointments(data.sort((a, b) => a.time.localeCompare(b.time)));
      }
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const cycleStatus = async (id, current) => {
    const idx = STATUS_ORDER.indexOf(current);
    const next = STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
    const { updateAppointment } = await import("../api");
    await updateAppointment(id, { status: next });
    load();
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
      .replace(/{date}/g, app.date || today)
      .replace(/{time}/g, app.time || "");

    if (!finalPhone || finalPhone === '964') {
      alert(t("رقم الهاتف غير صحيح أو مفقود"));
      return;
    }

    const url = `https://api.whatsapp.com/send?phone=${finalPhone}&text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="animate-fade" style={{ direction: "rtl", textAlign: "right", padding: "0 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 800, margin: 0 }}>📋 {t("جدول مواعيد اليوم")}</h1>
          <p style={{ color: "var(--text-muted)", marginTop: 8, fontSize: 18 }}>{new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <button onClick={() => nav("/appointments")} className="btn-ghost" style={{ fontSize: 16 }}>
          ⬅️ {t("العودة للمواعيد")}
        </button>
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
                className="glass-panel" 
                style={{ 
                  padding: 24, 
                  display: "flex", 
                  alignItems: "center", 
                  gap: 24,
                  cursor: "pointer",
                  borderRight: isNext ? "8px solid var(--primary)" : "1px solid rgba(255,255,255,0.1)",
                  background: isNext ? "rgba(24, 95, 165, 0.1)" : "rgba(255,255,255,0.03)",
                  transform: isNext ? "scale(1.02)" : "none",
                  transition: "all 0.3s"
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = isNext ? "rgba(24, 95, 165, 0.15)" : "rgba(255,255,255,0.06)";
                  if (isNext) e.currentTarget.style.transform = "scale(1.03)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = isNext ? "rgba(24, 95, 165, 0.1)" : "rgba(255,255,255,0.03)";
                  if (isNext) e.currentTarget.style.transform = "scale(1.02)";
                }}
              >
                <div style={{ 
                  fontSize: 32, 
                  fontWeight: 800, 
                  minWidth: 120, 
                  color: isNext ? "var(--primary)" : "white",
                  textAlign: "center",
                  background: "rgba(255,255,255,0.05)",
                  padding: "10px",
                  borderRadius: 12
                }}>
                  {app.time}
                </div>
 
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
                    <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{app.patient_name}</h2>
                    {isNext && <span style={{ background: "var(--primary)", color: "white", padding: "2px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{t("المريض التالي")}</span>}
                  </div>
                  <div style={{ fontSize: 16, color: "var(--text-muted)" }}>
                    🦷 {t(app.type)} · ⏳ {app.duration_min} {t("دقيقة")}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                   {app.status === "treating" && (
                     <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        nav(`/patients/${app.patient_id}?action=start-session`);
                      }}
                      className="animate-pulse"
                      style={{ 
                        padding: "10px 24px", borderRadius: 30, fontSize: 15, fontWeight: 800,
                        background: "var(--primary)", color: "white", border: "none", cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 8, boxShadow: "0 0 20px rgba(0, 210, 255, 0.4)",
                        transition: "all 0.2s"
                      }}
                     >
                       <span>🦷</span> <span>{t("بدأ جلسة العلاج")}</span>
                     </button>
                   )}

                   <button 
                    onClick={(e) => { e.stopPropagation(); cycleStatus(app.id, app.status); }}
                    style={{ 
                      padding: "10px 24px", borderRadius: 30, fontSize: 15, fontWeight: 700,
                      background: (STATUS_CONFIG[app.status] || STATUS_CONFIG["booked"]).bg,
                      color: (STATUS_CONFIG[app.status] || STATUS_CONFIG["booked"]).color,
                      border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, transition: "all 0.2s"
                    }}
                    onMouseEnter={e => e.currentTarget.style.filter = "brightness(1.1)"}
                    onMouseLeave={e => e.currentTarget.style.filter = "none"}
                   >
                     <span>{(STATUS_CONFIG[app.status] || STATUS_CONFIG["booked"]).icon}</span>
                     <span>{t((STATUS_CONFIG[app.status] || STATUS_CONFIG["booked"]).ar)}</span>
                   </button>
                   
                    {["finished", "postponed", "absent"].includes(app.status) && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          const newHidden = [...hiddenIds, app.id];
                          setHiddenIds(newHidden);
                          sessionStorage.setItem('today_hidden_ids', JSON.stringify(newHidden));
                        }}
                        style={{ 
                          width: 45, height: 45, borderRadius: 12, border: "none", 
                          background: "rgba(16, 185, 129, 0.2)", color: "#10b981", 
                          fontSize: 20, cursor: "pointer", transition: "all 0.2s"
                        }}
                        title={t("إخفاء من الجدول اليومي")}
                      >
                        ✔️
                      </button>
                    )}

                   {app.patient_phone && (
                     <div style={{ display: "flex", gap: 8 }} onClick={e => e.stopPropagation()}>
                       <a href={`tel:${app.patient_phone}`} className="contact-btn" style={{ width: 45, height: 45, borderRadius: 12, fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", background: "rgba(234, 179, 8, 0.1)", color: "#eab308" }}>📞</a>
                       <a 
                         href="#" 
                         onClick={(e) => { e.preventDefault(); e.stopPropagation(); sendWhatsApp(app); }}
                         className="contact-btn" 
                         style={{ width: 45, height: 45, borderRadius: 12, fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", background: "rgba(34, 197, 94, 0.1)", color: "#22c55e" }}
                       >
                         💬
                       </a>
                     </div>
                   )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        .contact-btn:hover { transform: translateY(-3px); filter: brightness(1.2); }
      `}</style>
    </div>
  );
}
