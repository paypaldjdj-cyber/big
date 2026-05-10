import { useState, useEffect } from "react";
import { useLanguage } from "../LanguageContext";
import { saveTeeth } from "../api";

export default function TeethMap({ initial, pid, treatments, onToothClick, onAddTreatment, readOnly = false, timelineIndex: manualIndex = null }) {
  const [data, setData] = useState(initial || {});
  const [hoveredTooth, setHoveredTooth] = useState(null);
  const [selectedTooth, setSelectedTooth] = useState(null);
  const [internalTimelineIndex, setInternalTimelineIndex] = useState(treatments ? treatments.length : 0);
  const timelineIndex = manualIndex !== null ? manualIndex : internalTimelineIndex;
  const [selectedStatus, setSelectedStatus] = useState("حشو");
  const { lang, t } = useLanguage();

  useEffect(() => {
    if (initial) setData(initial);
  }, [initial]);

  useEffect(() => {
    if (treatments) setInternalTimelineIndex(treatments.length);
  }, [treatments]);

  const sortedTreatments = [...(treatments || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
  const activeTreatments = sortedTreatments.slice(0, timelineIndex);
  const sortedDates = [...new Set(activeTreatments.map(tr => tr.date ? tr.date.split(' ')[0] : null).filter(Boolean))].sort((a, b) => new Date(a) - new Date(b));

  const getToothStatus = (id) => {
    const toothLogs = activeTreatments.filter(tr => tr.tooth_number == id);
    if (toothLogs.length === 0) return data[id]?.status || "سليم";
    return toothLogs[toothLogs.length - 1].procedure;
  };

  const statusColors = {
    "نخر": "#ef4444",
    "تسوس": "#ef4444",
    "ألم": "#ef4444",
    "حشو": "#10b981",
    "حشوة": "#10b981",
    "علاج عصب": "#f59e0b",
    "خلع": "#64748b",
    "مفقود": "#64748b",
    "تلبيس": "#3b82f6",
    "جسر": "#3b82f6",
    "زرعة": "#a855f7",
    "تقويم": "#ec4899",
    "سليم": "transparent"
  };

  const handleSurfaceClick = (toothId, surfaceId) => {
    if (readOnly) return;
    const color = statusColors[selectedStatus];
    const toothData = data[toothId] || { status: "سليم", surfaces: {} };
    const newSurfaces = { ...toothData.surfaces, [surfaceId]: color };
    setData({
      ...data,
      [toothId]: { ...toothData, surfaces: newSurfaces, last_modified: new Date().toISOString() }
    });
  };

  const upperTeeth = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
  const lowerTeeth = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

  return (
    <div className="animate-fade" style={{ direction: "ltr", color: "white" }}>
      <style>{`
        .jaw-arch { display: flex; justify-content: space-between; gap: 4px; padding: 30px 0; position: relative; width: 100%; max-width: 900px; margin: 0 auto; }
        .tooth-container { transition: all 0.2s; flex: 1; display: flex; justify-content: center; transform-origin: center center; }
        .tooth-container:hover { z-index: 50; filter: brightness(1.2); }
        .status-badge { padding: 4px 12px; border-radius: 20px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 30, direction: lang==="ar"?"rtl":"ltr" }}>
        <div>
          <h2 style={{ fontSize: 24, margin: 0, fontWeight: 800, background: "linear-gradient(90deg, #fff, var(--primary))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>🦷 {t("الخريطة التشريحية المتقدمة")}</h2>
          <p style={{ color: "var(--text-muted)", margin: "4px 0 0 0", fontSize: 13 }}>{t("رؤية كاملة لفك المريض وتاريخ المعالجة")}</p>
        </div>
        {!readOnly && <button onClick={() => saveTeeth(pid, data).then(() => alert(t("تم الحفظ ✓")))} className="btn-primary" style={{ boxShadow: "0 0 20px rgba(0, 210, 255, 0.3)" }}>✨ {t("حفظ الحالة")}</button>}
      </div>

      {treatments?.length > 0 && !readOnly && (
        <div className="glass-panel" style={{ padding: 20, marginBottom: 30, border: "1px solid rgba(0, 210, 255, 0.2)", background: "linear-gradient(180deg, rgba(24, 95, 165, 0.05) 0%, transparent 100%)" }}>
           <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 15 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 20 }}>🕒</span>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>{t("الجدول الزمني")}</div>
                  <div style={{ fontWeight: 700, color: "var(--primary)" }}>{timelineIndex === 0 ? t("الحالة الأولية") : activeTreatments[activeTreatments.length-1].date}</div>
                </div>
              </div>
              <div className="status-badge" style={{ background: "rgba(0, 210, 255, 0.1)", color: "var(--primary)" }}>
                {timelineIndex} / {treatments.length} {t("إجراء")}
              </div>
           </div>
           <input type="range" min="0" max={treatments.length} value={timelineIndex} onChange={(e) => setInternalTimelineIndex(parseInt(e.target.value))} style={{ width: "100%", height: 6, borderRadius: 3, accentColor: "var(--primary)", cursor: "pointer" }} />
        </div>
      )}

      {!readOnly && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 40, justifyContent: "center" }}>
        {Object.entries(statusColors).map(([name, color]) => (
          <div key={name} onClick={() => setSelectedStatus(name)} style={{ 
            padding: "8px 16px", borderRadius: 12, cursor: "pointer", fontSize: 12, fontWeight: 600,
            background: selectedStatus === name ? color : "rgba(255,255,255,0.03)",
            color: selectedStatus === name ? (color === "transparent" ? "white" : "#000") : "white",
            border: `1px solid ${selectedStatus === name ? color : "rgba(255,255,255,0.1)"}`,
            transition: "all 0.2s",
            boxShadow: selectedStatus === name ? `0 0 15px ${color}40` : "none"
          }}>
            {t(name)}
          </div>
        ))}
        </div>
      )}

      <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 30, padding: "40px 20px", border: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ textAlign: "center", fontSize: 10, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 2 }}>{t("الفك العلوي - Upper Arch")}</div>
        <div className="jaw-arch" style={{ marginBottom: 40 }}>
          {upperTeeth.map((id, i) => {
            const angle = (i - 7.5) * 6;
            const yOffset = Math.pow(i - 7.5, 2) * 0.8;
            return (
              <div key={id} className="tooth-container" style={{ transform: `rotate(${angle}deg) translateY(${yOffset}px)` }}>
                <ToothIcon 
                  id={id} 
                  status={getToothStatus(id)} 
                  surfaceData={data[id]?.surfaces}
                  onSurfaceClick={handleSurfaceClick}
                  onToothClick={(tid) => {
                    setSelectedTooth(tid);
                    if (onToothClick) onToothClick(tid);
                  }}
                  isHovered={hoveredTooth === id}
                  isSelected={selectedTooth === id}
                  onHover={setHoveredTooth}
                  lastLog={activeTreatments.filter(tr => tr.tooth_number == id).pop()}
                  statusColors={statusColors}
                />
              </div>
            );
          })}
        </div>

        <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)", margin: "0 40px 40px 40px" }} />

        <div className="jaw-arch">
          {lowerTeeth.map((id, i) => {
            const angle = (7.5 - i) * 6;
            const yOffset = -Math.pow(i - 7.5, 2) * 0.8;
            return (
              <div key={id} className="tooth-container" style={{ transform: `rotate(${angle}deg) translateY(${yOffset}px)` }}>
                <ToothIcon 
                  id={id} 
                  status={getToothStatus(id)} 
                  surfaceData={data[id]?.surfaces}
                  onSurfaceClick={handleSurfaceClick}
                  onToothClick={(tid) => {
                    setSelectedTooth(tid);
                    if (onToothClick) onToothClick(tid);
                  }}
                  isHovered={hoveredTooth === id}
                  isSelected={selectedTooth === id}
                  onHover={setHoveredTooth}
                  lastLog={activeTreatments.filter(tr => tr.tooth_number == id).pop()}
                  statusColors={statusColors}
                  isLower
                />
              </div>
            );
          })}
        </div>
        <div style={{ textAlign: "center", fontSize: 10, color: "var(--text-muted)", marginTop: 20, textTransform: "uppercase", letterSpacing: 2 }}>{t("الفك السفلي - Lower Arch")}</div>
      </div>

      {!readOnly && (
        <div style={{ marginTop: 40, borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 20, direction: lang==="ar"?"rtl":"ltr" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 15 }}>
            <h4 style={{ margin: 0 }}>📋 {t("سجل إجراءات")} {selectedTooth ? `${t("السن")} #${selectedTooth}` : t("الفك")}</h4>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn-primary" style={{ fontSize: 11, padding: "6px 12px" }} onClick={() => {
                if(onAddTreatment) onAddTreatment(selectedTooth || hoveredTooth);
              }}>+ {t("إضافة إجراء")}</button>
              {selectedTooth && <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => setSelectedTooth(null)}>{t("عرض الكل")}</button>}
            </div>
          </div>

          <div style={{ maxHeight: 350, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16, paddingRight: 10 }}>
            {sortedDates.length === 0 ? (
              <div style={{ textAlign: "center", padding: 30, color: "var(--text-muted)", background: "rgba(255,255,255,0.02)", borderRadius: 12, fontSize: 13 }}>
                {t("لا توجد إجراءات مسجلة.")}
              </div>
            ) : (
              [...sortedDates].reverse().map((date, idx, arr) => (
                <div key={date} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                     <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--primary)" }} />
                     <div style={{ fontWeight: 800, fontSize: 13, color: "var(--primary)" }}>{t("الجلسة")} #{arr.length - idx} <span style={{ fontWeight: 400, color: "var(--text-muted)", marginLeft: 8 }}>({date})</span></div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: 18 }}>
                     {activeTreatments.filter(tr => (!selectedTooth || tr.tooth_number == selectedTooth) && (tr.date && tr.date.split(' ')[0] === date)).map((tr, i) => (
                       <div key={i} style={{ display: "flex", gap: 12, padding: "8px 12px", background: "rgba(255,255,255,0.02)", borderRadius: 8 }}>
                          <div style={{ fontWeight: 800, color: "var(--accent)", fontSize: 12 }}>#{tr.tooth_number}</div>
                          <div style={{ flex: 1, fontSize: 13 }}>{tr.procedure} <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block" }}>{tr.notes}</span></div>
                          <div style={{ fontSize: 11, color: "#10b981", fontWeight: 700 }}>{(tr.cost || 0).toLocaleString()} {t("د")}</div>
                       </div>
                     ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ToothIcon({ id, status, surfaceData = {}, onSurfaceClick, onToothClick, isHovered, isSelected, onHover, lastLog, statusColors, isLower }) {
  const getStatusColor = (s) => {
    if (!s) return "transparent";
    for (let key in statusColors) if (s.includes(key)) return statusColors[key];
    return "transparent";
  };

  const color = getStatusColor(status);
  const isMissing = status.includes("خلع") || status.includes("مفقود");
  const isCrowned = status.includes("تلبيس") || status.includes("Crown") || status.includes("جسر");
  const isImplant = status.includes("زرعة") || status.includes("Implant");
  const isEndo = status.includes("عصب") || status.includes("Endo");

  return (
    <div 
      onMouseEnter={() => onHover(id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onToothClick(id)}
      style={{ 
        position: "relative", 
        width: 38, 
        height: 50, 
        opacity: isMissing ? 0.3 : 1, 
        transition: "all 0.2s",
        cursor: "pointer"
      }}
    >
      <div style={{ 
        width: "100%", height: "100%", 
        background: color !== "transparent" ? `${color}33` : "rgba(255,255,255,0.03)",
        border: isSelected ? "2px solid var(--primary)" : (isHovered ? "2px solid #fff" : `1px solid ${color !== "transparent" ? color : "rgba(255,255,255,0.15)"}`),
        borderRadius: isLower ? "10px 10px 4px 4px" : "4px 4px 10px 10px",
        position: "relative",
        boxShadow: isSelected ? `0 0 20px var(--primary)` : (isHovered ? `0 0 20px #fff4` : (color !== "transparent" ? `0 0 12px ${color}66` : "none")),
        overflow: "hidden",
        transition: "all 0.2s",
        zIndex: isSelected ? 10 : 1
      }}>
        <div style={{ position: "absolute", inset: 2, display: "grid", gridTemplateAreas: '"t t t" "l c r" "b b b"', gap: 1 }}>
          {["top", "left", "center", "right", "bottom"].map(sid => (
            <div key={sid} 
              onClick={(e) => { e.stopPropagation(); onSurfaceClick(id, sid); }}
              style={{ 
                gridArea: sid[0], 
                background: surfaceData[sid] || "transparent", 
                border: "1px solid rgba(255,255,255,0.15)",
                zIndex: 2
              }} 
            />
          ))}
        </div>
        {isEndo && <div style={{ position: "absolute", inset: "20% 45%", background: "var(--danger)", borderRadius: 10, boxShadow: "0 0 5px var(--danger)" }} />}
        {isImplant && <div style={{ position: "absolute", inset: "10% 40%", background: "#94a3b8", borderRadius: 2, border: "1px solid #fff" }} />}
        {isCrowned && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 6, background: "rgba(255,215,0,0.6)" }} />}
      </div>
      <div style={{ position: "absolute", [isLower?"bottom":"top"]: -18, left: "50%", transform: "translateX(-50%)", fontSize: 9, fontWeight: 800, color: isHovered ? "var(--primary)" : "var(--text-muted)" }}>{id}</div>
      {isMissing && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444", fontSize: 24, fontWeight: 900 }}>✕</div>}
      {isHovered && lastLog && (
        <div style={{ 
          position: "absolute", bottom: isLower ? "100%" : "auto", top: isLower ? "auto" : "100%", left: "50%", transform: "translateX(-50%)",
          background: "rgba(15, 23, 42, 0.95)", backdropFilter: "blur(10px)", border: "1px solid var(--primary)", padding: "12px",
          borderRadius: 12, fontSize: 11, width: 180, zIndex: 1000, boxShadow: "0 20px 40px rgba(0,0,0,0.6)", pointerEvents: "none"
        }}>
          <div style={{ fontWeight: 800, color: "var(--primary)", marginBottom: 4 }}>{lastLog.procedure}</div>
          <div style={{ color: "#cbd5e1", lineHeight: 1.4 }}>{lastLog.notes}</div>
          <div style={{ fontSize: 9, marginTop: 8, color: "var(--text-muted)", display: "flex", justifyContent: "space-between" }}>
             <span>📅 {lastLog.date}</span>
             <span style={{ color: "#10b981" }}>{lastLog.cost?.toLocaleString()} د</span>
          </div>
        </div>
      )}
    </div>
  );
}
