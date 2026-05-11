import React, { useState, useEffect } from "react";
import DrugAdder from "./DrugAdder";
import { createSmartPrescription, getPrescriptionPDFUrl, getSettings } from "../api";
import { useLanguage } from "../LanguageContext";

const DURATIONS = ["1 day","2 days","3 days","4 days","5 days","7 days","10 days","14 days","21 days","30 days"];
const TIMINGS = ["Once daily","Twice daily","Three times daily","Four times daily","Every 8 hours","Every 12 hours","As needed"];

export default function PrescriptionModal({ patient, onClose, onRefresh, existingData, isWizard = false, onAdd, initialMeds, initialDiagnosis }) {
  const { t } = useLanguage();
  const [step, setStep] = useState(isWizard ? 1 : 0);
  const [settings, setSettings] = useState({});
  const [editablePatient, setEditablePatient] = useState({
    name: existingData?.patient_name || `${patient.first_name} ${patient.last_name}`,
    age: existingData?.age || patient.age,
    gender: existingData?.gender || patient.gender,
    date: existingData?.date || new Date().toLocaleDateString('en-GB')
  });
  const [diagnosis, setDiagnosis] = useState(existingData?.diagnosis || initialDiagnosis || "");
  const [drugs, setDrugs] = useState(() => {
    try {
      return existingData?.drugs_json ? JSON.parse(existingData.drugs_json) : (initialMeds || []);
    } catch (e) {
      console.error("Prescription parsing error:", e);
      return initialMeds || [];
    }
  });
  const [loading, setLoading] = useState(false);

  const isReadOnly = !!existingData;

  useEffect(() => {
    getSettings().then(setSettings).catch(console.error);
  }, []);

  function addDrug(drugOrDrugs) {
    if (isReadOnly) return;
    let newDrugs;
    if (Array.isArray(drugOrDrugs)) {
      newDrugs = [...drugs, ...drugOrDrugs];
    } else {
      newDrugs = [...drugs, drugOrDrugs];
    }
    setDrugs(newDrugs);
    if (onAdd) onAdd(newDrugs);
    setStep(0);
  }

  function removeDrug(i) {
    if (isReadOnly) return;
    setDrugs((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateDrug(i, field, value) {
    if (isReadOnly) return;
    setDrugs(prev => prev.map((d, idx) => idx === i ? { ...d, [field]: value } : d));
  }


  async function save() {
    if (isReadOnly || drugs.length === 0) return;
    setLoading(true);
    try {
      // Strict English Check for Diagnosis
      const arabicPattern = /[\u0600-\u06FF]/;
      if (arabicPattern.test(diagnosis)) {
        alert("Arabic characters are NOT allowed in the diagnosis. Please use English only.");
        setLoading(false);
        return;
      }

      const payload = { 
        patient_id: patient.id, 
        diagnosis, 
        drugs,
        custom_info: editablePatient
      };

      const saveRes = await createSmartPrescription(payload);

      if (saveRes.id) {
        const url = getPrescriptionPDFUrl(saveRes.id);
        try {
          const user = JSON.parse(localStorage.getItem("clinic_user") || "{}");
          const pdfRes = await fetch(url, {
            headers: { "Authorization": user?.token ? `Bearer ${user.token}` : "" }
          });
          const blob = await pdfRes.blob();
          window.open(URL.createObjectURL(blob), "_blank");
          onRefresh();
          onClose();
        } catch (e) {
          console.error("PDF generation error:", e);
          alert("تم الحفظ بنجاح، ولكن فشل فتح ملف PDF للطباعة.");
          onRefresh();
          onClose();
        }
      }
    } catch(e) {
      alert("Error: " + e.message);
    } finally { 
      setLoading(false); 
    }
  }

  if (step === 1) {
    return (
      <div className="animate-fade" style={{ direction: "ltr", textAlign: "left" }}>
        <h3 style={{ marginBottom: 20 }}>💊 Add Drugs to Prescription</h3>
        <DrugAdder patient={patient} onAdd={addDrug} />
        <button className="btn-ghost" style={{ width: "100%", marginTop: 20 }} onClick={() => setStep(0)}>Back to Preview</button>
      </div>
    );
  }

  return (
    <div className="animate-fade" style={{ direction: "ltr", textAlign: "left", height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Action Bar */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginBottom: 15 }}>
        {!isReadOnly && !isWizard && (
          <button className="btn-primary" onClick={save} disabled={loading || drugs.length === 0}>
            {loading ? "Saving..." : "🖨 Save and Print"}
          </button>
        )}
        {isWizard && (
          <button className="btn-primary" onClick={onClose} style={{ background: "var(--success)" }}>
            {t("متابعة للملخص")} →
          </button>
        )}
        {isReadOnly && (
          <button className="btn-primary" onClick={async () => {
              const url = getPrescriptionPDFUrl(existingData.id);
            try {
        const user = JSON.parse(localStorage.getItem("clinic_user") || "{}");
        const pdfRes = await fetch(url, { headers: { "Authorization": `Bearer ${user.token}` } });
        const blob = await pdfRes.blob();
        window.open(URL.createObjectURL(blob), "_blank");
      } catch (e) {
        console.error("Print parsing error:", e);
        alert("فشل في استرداد بيانات الطباعة");
      }
          }}>🖨 Print PDF</button>
        )}
        {!isWizard && <button className="btn-ghost" onClick={onClose}>Close</button>}
      </div>

      {/* The Paper Container - Scaled to fit */}
      <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "flex-start", overflowY: "auto", background: "rgba(0,0,0,0.4)", borderRadius: 12, padding: "10px 0" }}>
        <div id="prescription-paper" style={{ 
          width: "100%", 
          maxWidth: "480px",
          height: "fit-content",
          aspectRatio: "1 / 1.414",
          background: "white", 
          color: "black", 
          borderRadius: 2, 
          boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
          position: "relative",
          padding: "0",
          display: "flex",
          flexDirection: "column",
          transform: "scale(0.75)",
          transformOrigin: "top center",
          marginBottom: "-120px" // Compensate for scaled space
        }}>
        {/* Header Image */}
        <div style={{ width: "100%", minHeight: 120, background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
          {settings.prescription_header ? (
            <img src={settings.prescription_header} style={{ width: "100%", maxHeight: 180, objectFit: "contain" }} alt="Header" />
          ) : (
            <div style={{ padding: 40, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
              {t("لا توجد صورة رأس للوصفة. يمكنك رفعها من الإعدادات.")}
            </div>
          )}
        </div>

        {/* Prescription Info Area */}
        <div style={{ padding: "30px 50px", flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 30 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ fontWeight: 600 }}>Name:</span>
                <input 
                  readOnly={isReadOnly}
                  value={editablePatient.name} 
                  onChange={e => setEditablePatient({...editablePatient, name: e.target.value})}
                  style={paperInputStyle} 
                />
              </div>
              <div style={{ display: "flex", gap: 20 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <span style={{ fontWeight: 600 }}>Age:</span>
                  <input 
                    readOnly={isReadOnly}
                    type="number"
                    value={editablePatient.age} 
                    onChange={e => setEditablePatient({...editablePatient, age: e.target.value})}
                    style={{ ...paperInputStyle, width: 50 }} 
                  />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <span style={{ fontWeight: 600 }}>Gender:</span>
                  <select 
                    disabled={isReadOnly}
                    value={editablePatient.gender} 
                    onChange={e => setEditablePatient({...editablePatient, gender: e.target.value})}
                    style={paperInputStyle}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ fontWeight: 600 }}>Date:</span>
              <input 
                readOnly={isReadOnly}
                type="text"
                value={editablePatient.date} 
                onChange={e => setEditablePatient({...editablePatient, date: e.target.value})}
                style={{ ...paperInputStyle, width: 100 }} 
              />
            </div>
          </div>

          <div style={{ marginBottom: 20, display: "flex", gap: 10, alignItems: "center" }}>
             <input 
               readOnly={isReadOnly}
               placeholder="Diagnosis / Notes (English)..." 
               value={diagnosis} 
               onChange={e => setDiagnosis(e.target.value)}
               style={{ ...paperInputStyle, flex: 1, fontSize: 16, borderBottom: "1px dashed #cbd5e1" }}
             />
          </div>

          {/* Rx Area */}
          <div style={{ position: "relative", minHeight: 300, border: "1px solid #f1f5f9", borderRadius: 8, padding: 20 }}>
             <div style={{ position: "absolute", top: 10, left: 15, fontSize: 32, fontWeight: 800, opacity: 0.1 }}>Rx</div>
             
             <ul style={{ listStyleType: "none", paddingLeft: 0, margin: 0 }}>
               {drugs.map((d, i) => (
                 <li key={i} style={{ marginBottom: 12, fontSize: 14, position: "relative", padding: "10px 12px", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                   <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                     <div style={{ flex: 1 }}>
                       {/* Drug Name & Form */}
                       <div style={{ fontWeight: 700, fontSize: 15, color: "#1e293b", marginBottom: 8 }}>
                         {i + 1}. {d.name}
                         <span style={{ fontWeight: 400, fontSize: 12, color: "#64748b", marginLeft: 6 }}>({d.form})</span>
                       </div>
                       {/* Inline Dropdowns Row */}
                       <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                         {/* Dose */}
                         <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                           <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Dose:</span>
                           {isReadOnly ? (
                             <span style={{ fontSize: 13, color: "#334155" }}>{d.dose}</span>
                           ) : (
                             <select
                               value={d.dose}
                               onChange={e => updateDrug(i, "dose", e.target.value)}
                               style={rxSelectStyle}
                             >
                               {(d.doseOptions || [d.dose]).map(o => <option key={o} value={o}>{o}</option>)}
                             </select>
                           )}
                         </div>
                         <span style={{ color: "#cbd5e1" }}>·</span>
                         {/* Timing */}
                         <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                           <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Frequency:</span>
                           {isReadOnly ? (
                             <span style={{ fontSize: 13, color: "#334155" }}>{d.timing}</span>
                           ) : (
                             <select
                               value={d.timing}
                               onChange={e => updateDrug(i, "timing", e.target.value)}
                               style={rxSelectStyle}
                             >
                               {[...(d.timingOptions || []), ...TIMINGS].filter((v, idx, arr) => arr.indexOf(v) === idx).map(o => <option key={o} value={o}>{o}</option>)}
                             </select>
                           )}
                         </div>
                         <span style={{ color: "#cbd5e1" }}>·</span>
                         {/* Duration */}
                         <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                           <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Duration:</span>
                           {isReadOnly ? (
                             <span style={{ fontSize: 13, color: "#334155" }}>{d.duration}</span>
                           ) : (
                             <select
                               value={d.duration}
                               onChange={e => updateDrug(i, "duration", e.target.value)}
                               style={rxSelectStyle}
                             >
                               {[...(d.durationOptions || []), ...DURATIONS].filter((v, idx, arr) => arr.indexOf(v) === idx).map(o => <option key={o} value={o}>{o}</option>)}
                             </select>
                           )}
                         </div>
                       </div>
                       {d.note && <div style={{ fontSize: 12, color: "#64748b", marginTop: 6, fontStyle: "italic" }}>Note: {d.note}</div>}
                     </div>
                     {!isReadOnly && (
                       <button onClick={() => removeDrug(i)} className="delete-btn" style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16, flexShrink: 0 }}>✕</button>
                     )}
                   </div>
                 </li>
               ))}
             </ul>

             {!isReadOnly && (
               <button 
                 onClick={() => setStep(1)}
                 style={{ 
                   width: "100%", 
                   padding: 20, 
                   border: "2px dashed #cbd5e1", 
                   borderRadius: 12, 
                   background: "none", 
                   cursor: "pointer", 
                   color: "#94a3b8",
                   marginTop: 20,
                   display: drugs.length > 5 ? "none" : "block"
                 }}
               >
                 + Click here to add drugs
               </button>
             )}
          </div>

          <div style={{ marginTop: 40, textAlign: "right", paddingRight: 40 }}>
             <div style={{ fontWeight: 600, marginBottom: 40 }}>Doctor's Signature</div>
             <div style={{ borderTop: "1px solid black", width: 150, display: "inline-block" }}></div>
          </div>
        </div>

        {/* Footer Image */}
        <div style={{ width: "100%", minHeight: 80, background: "#f8fafc", borderTop: "1px solid #e2e8f0" }}>
          {settings.prescription_footer ? (
            <img src={settings.prescription_footer} style={{ width: "100%", maxHeight: 120, objectFit: "contain" }} alt="Footer" />
          ) : (
            <div style={{ padding: 20, textAlign: "center", color: "#94a3b8", fontSize: 12 }}>
              {t("لا توجد صورة تذييل للوصفة.")}
            </div>
          )}
        </div>
        </div>
      </div>

      <style>{`
        #prescription-paper input, #prescription-paper select {
          border: none;
          background: transparent;
          color: black;
          font-family: inherit;
          padding: 2px 4px;
        }
        #prescription-paper input:hover, #prescription-paper select:hover {
          background: #f1f5f9;
        }
        #prescription-paper input:focus {
          outline: none;
          background: #f1f5f9;
          border-bottom: 1px solid #185FA5;
        }
        .delete-btn { opacity: 0; transition: opacity 0.2s; }
        li:hover .delete-btn { opacity: 1; }
      `}</style>
    </div>
  );
}

const paperInputStyle = {
  fontSize: "14px",
  color: "black",
  borderBottom: "1px solid transparent",
  transition: "all 0.2s"
};

const rxSelectStyle = {
  fontSize: "13px",
  color: "#1e293b",
  background: "white",
  border: "1px solid #cbd5e1",
  borderRadius: "6px",
  padding: "2px 6px",
  cursor: "pointer",
  fontFamily: "inherit",
};
