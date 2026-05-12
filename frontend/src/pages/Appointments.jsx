import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../LanguageContext";
import { useNavigate } from "react-router-dom";
import { getAppointments, getPatients, addAppointment, deleteAppointment, addPatient, sendReminders } from "../api";
import { useSettings } from "../SettingsContext";
import ConfirmModal from "../components/ConfirmModal";

const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const TREATMENT_TYPES = [
  "فحص دوري", "تنظيف أسنان", "حشو ضرس", "خلع ضرس",
  "علاج عصب", "تلبيس ضرس", "تقويم أسنان", "تبييض أسنان",
  "زراعة", "أشعة", "استشارة", "أخرى"
];

const STATUS_ORDER = ["booked", "waiting", "treating", "finished", "postponed", "absent"];
const STATUS_CONFIG = {
  "booked":    { ar: "محجوز", icon: "📅", color: "#185FA5", bg: "rgba(24, 95, 165, 0.15)" },
  "waiting":   { ar: "في الانتظار", icon: "⏳", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.15)" },
  "treating":  { ar: "قيد المعالجة", icon: "🦷", color: "#10b981", bg: "rgba(16, 185, 129, 0.15)" },
  "finished":  { ar: "منتهي", icon: "✅", color: "#065f46", bg: "rgba(6, 95, 70, 0.15)" },
  "postponed": { ar: "مؤجل", icon: "🕒", color: "#7c3aed", bg: "rgba(124, 58, 237, 0.15)" },
  "absent":    { ar: "غائب", icon: "❌", color: "#ef4444", bg: "rgba(239, 68, 68, 0.15)" },
};

const lblStyle = { display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 6, fontWeight: 500 };

export default function Appointments() {
  const { lang, t } = useLanguage();
  const { settings } = useSettings();
  const nav = useNavigate();
  const today = new Date();
  const searchRef = useRef(null);
  const [year,   setYear]   = useState(today.getFullYear());
  const [month,  setMonth]  = useState(today.getMonth());
  const [selDay, setSelDay] = useState(today.getDate());
  const [apts,   setApts]   = useState([]);
  const [allApts,setAllApts]= useState([]);
  const [patients, setPatients] = useState([]);
  const [modal,  setModal]  = useState(false);
  const [saving, setSaving] = useState(false);
  const [form,   setForm]   = useState({
    patient_id: "", date: "", time: "", type: "", duration_min: 30, status: "booked", notes: ""
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [patientSaving, setPatientSaving] = useState(false);
  const [reminderModal, setReminderModal] = useState(false);
  const [tomorrowApts, setTomorrowApts] = useState([]);
  const [confirmData, setConfirmData] = useState({ show: false, message: "", onConfirm: null });
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [dailyView, setDailyView] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const dateStr = (d = selDay) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

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
    getAppointments(dateStr()).then(data => {
      const mapped = data.map(a => ({ ...a, status: mapStatus(a.status) }));
      setApts(mapped);
    }).catch(console.error);
    
    getAppointments().then(data => {
      const mapped = data.map(a => ({ ...a, status: mapStatus(a.status) }));
      setAllApts(mapped);
    }).catch(console.error);
  };

  useEffect(() => { load(); }, [year, month, selDay]);
  useEffect(() => { getPatients().then(setPatients).catch(console.error); }, []);

  // Click outside search results to close
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const daysInMonth  = new Date(year, month + 1, 0).getDate();
  const firstWeekDay = new Date(year, month, 1).getDay();
  const aptDays = new Set(allApts.filter(a => a.date && typeof a.date === 'string').map(a => parseInt(a.date.split("-")[2])));

  const openModal = () => {
    setForm({ patient_id: "", date: dateStr(), time: "", type: "", duration_min: 30, status: "booked", notes: "" });
    setSearchTerm("");
    setShowResults(false);
    setModal(true);
  };

  const quickAddPatient = async () => {
    console.log("Quick Add Clicked. SearchTerm:", searchTerm);
    const trimmedTerm = searchTerm.trim();
    if (!trimmedTerm) return;
    
    setPatientSaving(true);
    try {
      // Check if exists
      const exists = patients.find(p => 
        `${p.first_name} ${p.last_name}`.trim().toLowerCase() === trimmedTerm.toLowerCase()
      );
      
      if (exists) {
        console.log("Patient exists:", exists);
        alert(t("المريض موجود بالفعل"));
        setForm(f => ({ ...f, patient_id: exists.id }));
        setSearchTerm(`${exists.first_name} ${exists.last_name}`.trim());
        setShowResults(false);
        setPatientSaving(false);
        return;
      }

      const nameParts = trimmedTerm.split(/\s+/);
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(" ");
      
      console.log("Sending Add Patient Request...", { firstName, lastName });
      const res = await addPatient({ first_name: firstName, last_name: lastName });
      console.log("Add Patient Response:", res);
      
      if (res && res.id) {
        const newPatient = { 
          id: res.id, 
          first_name: firstName, 
          last_name: lastName,
          phone: "" 
        };
        
        setPatients(prev => [newPatient, ...prev]);
        setForm(f => ({ ...f, patient_id: res.id }));
        setSearchTerm(`${firstName} ${lastName}`.trim());
        setShowResults(false);
      } else {
        throw new Error("Invalid response");
      }
    } catch (e) {
      console.error("Quick Add Error:", e);
      alert(t("خطأ في إضافة المريض") + " (" + e.message + ")");
    }
    setPatientSaving(false);
  };

  const filteredPatients = patients.filter(p => 
    `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.phone?.includes(searchTerm)
  );

  const save = async () => {
    if (!form.patient_id || !form.date || !form.time) return alert(t("أدخل المريض والتاريخ والوقت"));
    setSaving(true);
    await addAppointment({ ...form, patient_id: parseInt(form.patient_id) }).catch(console.error);
    setSaving(false);
    setModal(false);
    load();
  };

  const cycleStatus = async (id, current) => {
    // Map legacy Arabic values to keys if needed
    let currentKey = current;
    if (current === "قادم" || current === "محجوز") currentKey = "booked";
    if (current === "في الانتظار") currentKey = "waiting";
    if (current === "قيد المعالجة") currentKey = "treating";
    if (current === "منتهي") currentKey = "finished";
    
    const idx = STATUS_ORDER.indexOf(currentKey);
    const next = STATUS_ORDER[idx === -1 ? 0 : (idx + 1) % STATUS_ORDER.length];
    const { updateAppointment } = await import("../api");
    await updateAppointment(id, { status: next });
    load();
  };

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  return (
    <div className="animate-fade">
      {/* Header */}
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "center", gap: 16, marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{t("إدارة المواعيد")}</h2>
        <div style={{ display: "flex", gap: 8, width: isMobile ? "100%" : "auto", overflowX: isMobile ? "auto" : "visible", paddingBottom: isMobile ? 8 : 0 }}>
          <button onClick={() => setDailyView(true)} className="btn-ghost" style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(24, 95, 165, 0.1)", color: "var(--primary)", whiteSpace: "nowrap", flexShrink: 0 }}>
            <span>🖥️</span> <span>{isMobile ? "" : t("عرض الجدول اليومي")}</span>
          </button>
          <button onClick={async () => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
            const res = await getAppointments(tStr);
            setTomorrowApts(res);
            setReminderModal(true);
          }} className="btn-ghost" style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(34, 197, 94, 0.1)", color: "#22c55e", whiteSpace: "nowrap", flexShrink: 0 }}>
            <span>🔔</span> <span>{isMobile ? "" : t("إرسال تذكيرات الغد")}</span>
          </button>
          <button onClick={openModal} className="btn-primary" style={{ whiteSpace: "nowrap", flexShrink: 0, flex: isMobile ? 1 : "none" }}>
            <span>+</span> {t("موعد جديد")}
          </button>
        </div>
      </div>
      
      {dailyView && (
        <div className="animate-fade" style={{ position: "absolute", inset: 0, background: "var(--bg-dark)", zIndex: 100, padding: isMobile ? 12 : 32, overflowY: "auto" }}>
           <div style={{ 
             display: "flex", 
             flexDirection: isMobile ? "column" : "row",
             alignItems: isMobile ? "flex-start" : "center", 
             justifyContent: "space-between", 
             gap: 16,
             marginBottom: 32 
           }}>
             <button className="btn-secondary" onClick={() => setDailyView(false)} style={{ width: isMobile ? "100%" : "auto" }}>⬅️ {t("العودة للمواعيد")}</button>
             <div style={{ textAlign: isMobile ? "right" : "left", width: isMobile ? "100%" : "auto" }}>
                <h2 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 800, margin: 0 }}>📋 {t("جدول مواعيد اليوم")}</h2>
                <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>{today.toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
             </div>
           </div>

           <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
             {apts.length === 0 ? (
               <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)", background: "rgba(255,255,255,0.02)", borderRadius: 24 }}>
                 <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
                 <div>{t("لا توجد مواعيد مسجلة لهذا اليوم")}</div>
               </div>
             ) : [...apts].sort((a,b) => a.time.localeCompare(b.time)).map(v => (
               <div key={v.id} className="glass-panel animate-fade" style={{ 
                 padding: isMobile ? 16 : 24, 
                 display: "flex", 
                 flexDirection: isMobile ? "column" : "row",
                 alignItems: isMobile ? "stretch" : "center", 
                 gap: isMobile ? 12 : 24, 
                 borderRight: `6px solid ${(STATUS_CONFIG[v.status] || STATUS_CONFIG["booked"]).color}`,
                 background: "linear-gradient(90deg, rgba(255,255,255,0.03) 0%, transparent 100%)"
               }}>
                 <div style={{ 
                   background: "rgba(24, 95, 165, 0.15)", 
                   padding: isMobile ? "12px" : "15px 25px", 
                   borderRadius: 16, 
                   textAlign: "center",
                   minWidth: isMobile ? "auto" : 120
                 }}>
                   <div style={{ fontSize: isMobile ? 24 : 32, fontWeight: 900, color: "var(--primary)" }}>{v.time}</div>
                   <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", marginTop: 4 }}>{t("التوقيت")}</div>
                 </div>
                 
                 <div style={{ flex: 1 }}>
                   <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, marginBottom: 4 }}>{v.patient_name}</div>
                   <div style={{ display: "flex", flexWrap: "wrap", gap: 12, color: "var(--text-muted)", fontSize: 13 }}>
                     <span>🦷 {v.type || t("فحص عام")}</span>
                     <span>⏳ {v.duration_min} {t("دقيقة")}</span>
                     {v.notes && <span>📝 {v.notes}</span>}
                   </div>
                 </div>

                 <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: isMobile ? "space-between" : "flex-end", flexWrap: "wrap", marginTop: isMobile ? 8 : 0 }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      {v.status === "treating" && (
                        <button 
                         onClick={(e) => {
                           e.stopPropagation();
                           nav(`/patients/${v.patient_id}?action=start-session`);
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
                       onClick={(e) => { e.stopPropagation(); cycleStatus(v.id, v.status); }}
                       style={{ 
                         padding: "8px 16px", borderRadius: 12, fontSize: 12, fontWeight: 700,
                         background: (STATUS_CONFIG[v.status] || STATUS_CONFIG["booked"]).bg,
                         color: (STATUS_CONFIG[v.status] || STATUS_CONFIG["booked"]).color,
                         border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6
                       }}
                      >
                        <span>{(STATUS_CONFIG[v.status] || STATUS_CONFIG["booked"]).icon}</span>
                        <span>{(STATUS_CONFIG[v.status] || STATUS_CONFIG["booked"]).ar}</span>
                      </button>
                    </div>

                    <div style={{ display: "flex", gap: 8 }}>
                       {["finished", "postponed", "absent"].includes(v.status) && (
                         <button 
                           onClick={(e) => {
                             e.stopPropagation();
                             // Hide logic: update status to something that hides it, or just remove from local state
                             setApts(prev => prev.filter(app => app.id !== v.id));
                           }}
                           className="btn-ghost"
                           style={{ 
                             width: 36, height: 36, borderRadius: 10, border: "none", 
                             background: "rgba(16, 185, 129, 0.1)", color: "#10b981", 
                             fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
                           }}
                           title={t("إخفاء")}
                         >
                           ✔️
                         </button>
                       )}
                       <button onClick={(e) => { e.stopPropagation(); nav(`/patients/${v.patient_id}`); }} className="btn-ghost" style={{ padding: "8px 12px", background: "rgba(255,255,255,0.05)", borderRadius: 10, border: "none", cursor: "pointer" }}>👤</button>
                    </div>
                 </div>
               </div>
             ))}
           </div>
        </div>
      )}

      <div className="appointments-grid">
        <div className="glass-panel" style={{ padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ fontWeight: 600, fontSize: 16 }}>{t(MONTHS[month])} {year}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={prevMonth} className="btn-ghost" style={{ padding: "4px 12px", fontSize: 18 }}>‹</button>
              <button onClick={nextMonth} className="btn-ghost" style={{ padding: "4px 12px", fontSize: 18 }}>›</button>
            </div>
          </div>

          <div className="calendar-grid" style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 8 }}>
            {["أح", "اث", "ثل", "أر", "خم", "جم", "سب"].map(d => (
              <div key={d} style={{ textAlign: "center", fontSize: 10, color: "var(--text-muted)", fontWeight: 600, padding: "4px 0" }}>{t(d)}</div>
            ))}
          </div>

          <div className="calendar-grid" style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
            {Array(firstWeekDay).fill(null).map((_, i) => <div key={"e" + i} />)}
            {Array(daysInMonth).fill(null).map((_, i) => {
              const d = i + 1;
              const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
              const isSel = d === selDay;
              const hasApt = aptDays.has(d);
              return (
                <div key={d} onClick={() => setSelDay(d)} style={{
                  height: 36, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  borderRadius: 8, fontSize: 13, cursor: "pointer", position: "relative",
                  background: isSel ? "var(--primary)" : isToday ? "rgba(24,95,165,0.2)" : "transparent",
                  color: isSel ? "white" : isToday ? "var(--primary)" : "white",
                  fontWeight: isSel || isToday ? 700 : 400,
                  border: hasApt && !isSel ? "1px solid rgba(24,95,165,0.4)" : "1px solid transparent",
                  transition: "all 0.15s"
                }}>
                  {d}
                  {hasApt && !isSel && (
                    <div style={{ position: "absolute", bottom: 3, width: 4, height: 4, borderRadius: "50%", background: "var(--primary)" }} />
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", gap: 16, fontSize: 11, color: "var(--text-muted)" }}>
            <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "var(--primary)", marginLeft: 4 }} />يوم فيه موعد</span>
            <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "var(--primary)", marginLeft: 4 }} />اليوم المحدد</span>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ fontSize: 18, fontWeight: 600 }}>
              📅 مواعيد {selDay} {t(MONTHS[month])} {year}
            </h3>
            <span style={{ fontSize: 12, color: "var(--text-muted)", background: "rgba(255,255,255,0.05)", padding: "4px 12px", borderRadius: 20 }}>
              {apts.length} موعد
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {apts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                <div>{t("لا توجد مواعيد في هذا اليوم")}</div>
                <button onClick={openModal} className="btn-ghost" style={{ marginTop: 16, fontSize: 13 }}>+ أضف موعداً</button>
              </div>
            ) : apts.map(a => {
              const sc = STATUS_CONFIG[a.status] || STATUS_CONFIG["booked"];
              let isSoon = false;
              if (a.status === "booked" && a.date && typeof a.date === 'string' && a.date === new Date().toISOString().split('T')[0]) {
                const [h, m] = a.time.split(':');
                const aptTime = new Date();
                aptTime.setHours(parseInt(h), parseInt(m), 0);
                const diffMs = aptTime - new Date();
                const diffHours = diffMs / (1000 * 60 * 60);
                if (diffHours > 0 && diffHours <= 2) isSoon = true;
              }

              return (
                <div key={a.id} 
                  onClick={() => nav(`/patients/${a.patient_id}`)}
                  style={{
                    display: "flex", alignItems: "center", gap: isMobile ? 10 : 16, padding: isMobile ? "12px 14px" : "16px 20px",
                    background: isSoon ? "rgba(245, 158, 11, 0.1)" : "rgba(255,255,255,0.03)", 
                    borderRadius: 14,
                    border: isSoon ? "1px solid rgba(245, 158, 11, 0.3)" : "1px solid rgba(255,255,255,0.07)", 
                    transition: "all 0.3s",
                    position: "relative",
                    cursor: "pointer",
                    overflow: "hidden"
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = isSoon ? "rgba(245, 158, 11, 0.15)" : "rgba(255,255,255,0.06)";
                    e.currentTarget.style.transform = "translateX(-5px)";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = isSoon ? "rgba(245, 158, 11, 0.1)" : "rgba(255,255,255,0.03)";
                    e.currentTarget.style.transform = "none";
                  }}
                >
                  {isSoon && (
                    <div style={{ position: "absolute", top: -8, right: 20, background: "#f59e0b", color: "white", fontSize: 10, padding: "2px 8px", borderRadius: 10, fontWeight: 700 }}>
                      {t("يقترب موعده")} ⏰
                    </div>
                  )}
                  <div style={{
                    minWidth: 60, textAlign: "center", padding: "8px 4px", borderRadius: 10,
                    background: "rgba(24,95,165,0.15)", color: "var(--primary)", fontWeight: 700, fontSize: 15
                  }}>
                    {a.time}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{a.patient_name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {a.type || "—"} · {a.duration_min || 30} دقيقة
                      {a.notes && <span> · {a.notes}</span>}
                    </div>
                  </div>

                  <button 
                    onClick={(e) => { e.stopPropagation(); cycleStatus(a.id, a.status); }}
                    style={{ 
                      fontSize: 10, padding: isMobile ? "4px 8px" : "6px 14px", borderRadius: 20, 
                      background: (STATUS_CONFIG[a.status] || STATUS_CONFIG["booked"]).bg, 
                      color: (STATUS_CONFIG[a.status] || STATUS_CONFIG["booked"]).color, 
                      fontWeight: 700, border: "none", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 4, transition: "all 0.2s",
                      whiteSpace: "nowrap"
                    }}
                    onMouseEnter={e => e.currentTarget.style.filter = "brightness(1.1)"}
                    onMouseLeave={e => e.currentTarget.style.filter = "none"}
                  >
                    <span>{(STATUS_CONFIG[a.status] || STATUS_CONFIG["booked"]).icon}</span>
                    <span>{t((STATUS_CONFIG[a.status] || STATUS_CONFIG["booked"]).ar)}</span>
                  </button>

                  {a.patient_phone && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        const cleanPhone = a.patient_phone.replace(/[^0-9]/g, '');
                        const finalPhone = cleanPhone.startsWith('0') ? '964' + cleanPhone.substring(1) : cleanPhone.startsWith('964') ? cleanPhone : '964' + cleanPhone;
                        
                        const defaultReminder = "تذكير: موعدك اليوم في الساعة {time}. يرجى الحضور قبل الموعد بـ 5 دقائق. عيادة الدكتور.";
                        const template = settings.whatsapp_template_reminder || defaultReminder;
                        const message = template
                          .replace(/{patient}/g, a.patient_name || "")
                          .replace(/{date}/g, a.date || "")
                          .replace(/{time}/g, a.time || "");

                        if (!finalPhone || finalPhone === '964') return alert(t("رقم الهاتف غير صحيح"));
                        window.open(`https://api.whatsapp.com/send?phone=${finalPhone}&text=${encodeURIComponent(message)}`, '_blank');
                      }}
                      className="btn-ghost"
                      style={{ 
                        padding: "6px 12px", fontSize: 13, background: "rgba(34, 197, 94, 0.15)", color: "#22c55e",
                        display: "flex", alignItems: "center", gap: 6, borderRadius: 10
                      }}
                    >
                      <span>💬</span>
                      <span className="desktop-only">{t("تذكير")}</span>
                    </button>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmData({
                        show: true,
                        message: t("هل متأكد من حذف الموعد؟"),
                        onConfirm: () => {
                          setConfirmData({ show: false });
                          deleteAppointment(a.id).then(load);
                        }
                      });
                    }}
                    className="btn-ghost"
                    style={{ padding: "6px 10px", fontSize: 14, color: "var(--danger)", opacity: 0.7 }}
                    title="حذف"
                  >✕</button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {reminderModal && createPortal(
        <Modal title={t("تذكيرات مواعيد الغد")} onClose={() => setReminderModal(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, direction: lang==="ar"?"rtl":"ltr", textAlign: lang==="ar"?"right":"left" }}>
            {tomorrowApts.length === 0 ? (
              <div style={{ textAlign: "center", padding: 20, color: "var(--text-muted)" }}>{t("لا توجد مواعيد ليوم غد")}</div>
            ) : (
              tomorrowApts.map(a => (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: 12, background: "rgba(255,255,255,0.03)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ background: "var(--primary)", color: "white", padding: "4px 10px", borderRadius: 8, fontWeight: 700, fontSize: 13 }}>{a.time}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{a.patient_name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{a.patient_phone || t("بدون رقم هاتف")}</div>
                  </div>
                  {a.patient_phone && (
                    <button 
                      onClick={() => {
                        const cleanPhone = a.patient_phone.replace(/[^0-9]/g, '');
                        const finalPhone = cleanPhone.startsWith('0') ? '964' + cleanPhone.substring(1) : cleanPhone.startsWith('964') ? cleanPhone : '964' + cleanPhone;
                        
                        const defaultBooking = "أهلاً {patient}، تم حجز موعدك في عيادتنا بتاريخ {date} الساعة {time}. ننتظر زيارتك.";
                        const template = settings.whatsapp_template_booking || defaultBooking;
                        const message = template
                          .replace(/{patient}/g, a.patient_name || "")
                          .replace(/{date}/g, a.date || "")
                          .replace(/{time}/g, a.time || "");

                        if (!finalPhone || finalPhone === '964') return alert(t("رقم الهاتف غير صحيح"));
                        window.open(`https://api.whatsapp.com/send?phone=${finalPhone}&text=${encodeURIComponent(message)}`, '_blank');
                      }}
                      className="btn-primary" 
                      style={{ background: "#22c55e", borderColor: "#22c55e", padding: "6px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <span>💬</span> WhatsApp
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </Modal>
      , document.body)}

      {modal && createPortal(
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: isMobile ? "10px" : "20px" }}>
          <div className="glass-panel animate-fade" style={{ 
            width: "100%", 
            maxWidth: 580, 
            padding: isMobile ? "24px 20px" : "36px", 
            maxHeight: "92vh", 
            overflowY: "auto",
            position: "relative"
          }}>
            <h3 style={{ fontSize: isMobile ? 20 : 22, fontWeight: 700, marginBottom: 24, textAlign: "center" }}>{t("إضافة موعد جديد")}</h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={lblStyle}>{t("المريض *")}</label>
                <div style={{ position: "relative" }} ref={searchRef} onMouseDown={e => e.stopPropagation()}>
                  <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 8 }}>
                    <div style={{ position: "relative", flex: 1 }}>
                      <input 
                        className="glass-input" 
                        style={{ width: "100%", paddingRight: 40 }}
                        placeholder={t("بحث عن مريض...")}
                        value={searchTerm}
                        onFocus={() => setShowResults(true)}
                        onChange={e => {
                          setSearchTerm(e.target.value);
                          setShowResults(true);
                          if (!e.target.value) setForm({ ...form, patient_id: "" });
                        }}
                      />
                      <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", opacity: 0.5 }}>🔍</span>
                    </div>
                    <button 
                      type="button"
                      className="btn-secondary" 
                      onClick={quickAddPatient}
                      disabled={patientSaving}
                      style={{ padding: "0 15px", whiteSpace: "nowrap", height: 46, opacity: patientSaving ? 0.5 : 1 }}
                      title={t("إضافة مريض جديد بهذا الاسم")}
                    >
                      {patientSaving ? "..." : "+ " + t("إضافة سريع")}
                    </button>
                  </div>
                  
                  {showResults && searchTerm && (
                    <div className="glass-panel" style={{ 
                      position: "absolute", top: "105%", left: 0, right: 0, zIndex: 100,
                      maxHeight: 240, overflowY: "auto", padding: 8,
                      boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
                      border: "1px solid rgba(255,255,255,0.1)"
                    }}>
                      {filteredPatients.length === 0 ? (
                        <div style={{ padding: 12, color: "var(--text-muted)", textAlign: "center", fontSize: 13 }}>
                          <div>{t("لا يوجد مريض بهذا الاسم")}</div>
                          <div style={{ fontSize: 11, marginTop: 4 }}>{t("يمكنك الضغط على إضافة سريع لإنشاء حساب له")}</div>
                        </div>
                      ) : (
                        filteredPatients.map(p => (
                          <div key={p.id} 
                            onClick={() => {
                              setForm({ ...form, patient_id: p.id });
                              setSearchTerm(`${p.first_name} ${p.last_name}`);
                              setShowResults(false);
                            }}
                            style={{ 
                              padding: "10px 16px", cursor: "pointer", borderRadius: 10,
                              background: form.patient_id == p.id ? "rgba(24, 95, 165, 0.3)" : "transparent",
                              marginBottom: 4, transition: "all 0.2s"
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}
                            onMouseLeave={e => e.currentTarget.style.background = form.patient_id == p.id ? "rgba(24, 95, 165, 0.3)" : "transparent"}
                          >
                            <div style={{ fontWeight: 600, display: "flex", justifyContent: "space-between" }}>
                              <span>{p.first_name} {p.last_name}</span>
                              {form.patient_id == p.id && <span style={{ color: "var(--accent)" }}>✓</span>}
                            </div>
                            {p.phone && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>📞 {p.phone}</div>}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={lblStyle}>{t("التاريخ *")}</label>
                  <input type="date" className="glass-input" style={{ width: "100%" }}
                    value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                </div>
                <div>
                  <label style={lblStyle}>{t("الوقت *")}</label>
                  <input type="time" className="glass-input" style={{ width: "100%" }}
                    value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={lblStyle}>{t("نوع العلاج")}</label>
                  <select className="glass-input" style={{ width: "100%" }}
                    value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                    <option value="">{t("اختر النوع...")}</option>
                    {TREATMENT_TYPES.map(typ => <option key={typ} value={typ}>{t(typ)}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lblStyle}>{t("المدة (دقيقة)")}</label>
                  <select className="glass-input" style={{ width: "100%" }}
                    value={form.duration_min} onChange={e => setForm({ ...form, duration_min: parseInt(e.target.value) })}>
                    {[15, 20, 30, 45, 60, 90, 120].map(d => <option key={d} value={d}>{d} {t("دقيقة")}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={lblStyle}>{t("الحالة")}</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {STATUS_ORDER.map(s => {
                    const sc = STATUS_CONFIG[s];
                    return (
                      <button key={s} onClick={() => setForm({ ...form, status: s })}
                        style={{
                          flex: "1 1 100px", padding: "10px 4px", borderRadius: 10, border: `2px solid ${form.status === s ? sc.color : "transparent"}`,
                          background: form.status === s ? sc.bg : "rgba(255,255,255,0.04)",
                          color: form.status === s ? sc.color : "var(--text-muted)",
                          fontWeight: 600, cursor: "pointer", fontSize: 12, transition: "all 0.15s"
                        }}>
                        {sc.icon} {t(sc.ar)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label style={lblStyle}>{t("ملاحظات")}</label>
                <input type="text" className="glass-input" style={{ width: "100%" }}
                  placeholder={t("أي ملاحظات خاصة بالموعد...")}
                  value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 28, flexDirection: isMobile ? "column-reverse" : "row" }}>
              <button onClick={() => setModal(false)} className="btn-ghost" style={{ flex: 1, height: 48 }}>{t("إلغاء")}</button>
              <button onClick={save} disabled={saving} className="btn-primary" style={{ flex: 2, height: 48 }}>
                {saving ? t("جاري الحفظ...") : t("✓ حفظ الموعد")}
              </button>
            </div>
          </div>
        </div>
      , document.body)}
      <style>{`
        .appointments-grid { display: grid; grid-template-columns: 340px 1fr; gap: 24px; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .mobile-mode .appointments-grid { grid-template-columns: 1fr !important; gap: 16px !important; }
        .mobile-mode .grid-2 { grid-template-columns: 1fr !important; }
        .mobile-mode .calendar-grid { gap: 1px !important; }
        .desktop-only { display: inline; }
        .mobile-mode .desktop-only { display: none; }
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

function Modal({ title, onClose, children }) {
  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
      <div className="glass-panel animate-fade" style={{ width: "100%", maxWidth: 600, padding: 32, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
          <h3 style={{ fontSize: 20 }}>{title}</h3>
          <button onClick={onClose} className="btn-ghost" style={{ fontSize: 20, padding: "0 10px" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  , document.body);
}
