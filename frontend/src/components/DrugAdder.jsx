import React, { useState, useEffect, useRef } from "react";
import { getDrugs } from "../api";
import { useLanguage } from "../LanguageContext";
import ConfirmModal from "./ConfirmModal";

function calcDose(drug, patient) {
// ...
// (rest of the helper functions remain the same)
  const age = parseInt(patient.age) || 30;
  const weight = parseFloat(patient.weight) || 70;
  const special = patient.systemic_conditions || "none"; // changed to match target DB
  let group = "adult";
  if (age < 12) group = "child";
  else if (age >= 65 || special.includes("elderly")) group = "elderly";
  const doses = drug.doses[group]?.length ? drug.doses[group] : drug.doses.adult;
  let recommended = doses[0] || "";
  if (group === "child" && recommended.includes("mg/kg")) {
    const factor = parseFloat(recommended);
    const calc = Math.round(factor * weight);
    recommended = `${calc}mg (${factor}mg/kg × ${weight}كغ)`;
  } else if (group === "adult" && weight > 90 && doses.length > 1) {
    recommended = doses[1];
  }
  return { recommended, doses, group };
}

function getWarnings(drug, patient) {
  const warnings = [];
  const special = (patient.systemic_conditions || "").toLowerCase();
  const age = parseInt(patient.age) || 30;
  
  if ((special.includes("pregnant") || special.includes("حمل")) && drug.warnings?.pregnant)
    warnings.push({ label: "Pregnant", text: drug.warnings.pregnant, type: "red" });
  if ((special.includes("breastfeed") || special.includes("رضاعة")) && drug.warnings?.breastfeed)
    warnings.push({ label: "Breastfeeding", text: drug.warnings.breastfeed, type: "red" });
  if ((special.includes("renal") || special.includes("كلى") || special.includes("kidney")) && drug.warnings?.renal)
    warnings.push({ label: "Renal Impairment", text: drug.warnings.renal, type: "amber" });
  if ((special.includes("hepatic") || special.includes("كبد") || special.includes("liver")) && drug.warnings?.hepatic)
    warnings.push({ label: "Hepatic Impairment", text: drug.warnings.hepatic, type: "amber" });
    
  if ((special.includes("allergy") || special.includes("حساسية")) && drug.warnings?.allergy)
    warnings.push({ label: "Allergy", text: drug.warnings.allergy, type: "amber" });
  if ((special.includes("diabetes") || special.includes("سكر")) && drug.warnings?.diabetes)
    warnings.push({ label: "Diabetes", text: drug.warnings.diabetes, type: "amber" });
  if ((special.includes("pressure") || special.includes("ضغط") || special.includes("hypertension")) && drug.warnings?.blood_pressure)
    warnings.push({ label: "Blood Pressure", text: drug.warnings.blood_pressure, type: "amber" });
    
  if (age < 12) warnings.push({ label: "Pediatric Dose", text: "", type: "blue" });
  else if (age >= 65) warnings.push({ label: "Elderly Dose", text: "", type: "blue" });
  return warnings;
}

export default function DrugAdder({ patient, onAdd }) {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [dose, setDose] = useState("");
  const [dosesOptions, setDosesOptions] = useState([]);
  const [timing, setTiming] = useState("");
  const [duration, setDuration] = useState("");
  const [form, setForm] = useState("");
  const [note, setNote] = useState("");
  const [warnings, setWarnings] = useState([]);
  const [showSug, setShowSug] = useState(false);
  const [confirmData, setConfirmData] = useState({ show: false, message: "", onConfirm: null });
  const wrapRef = useRef();

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowSug(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);


  useEffect(() => {
    if (!query.trim()) {
      // Load favorites by default
      getDrugs("").then(all => {
        setSuggestions(all.filter(d => d.is_favorite).slice(0, 10));
        if (all.filter(d => d.is_favorite).length > 0) setShowSug(true);
      }).catch(e => console.error(e));
      return;
    }
    const t = setTimeout(() => {
      getDrugs(query).then((r) => { 
        setSuggestions(r.slice(0, 8)); 
        setShowSug(true); 
      }).catch(e => console.error(e));
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  function selectDrug(drug) {
    setSelected(drug);
    setQuery(drug.name);
    setShowSug(false);
    setSuggestions([]);
    const { recommended, doses } = calcDose(drug, patient);
    setDosesOptions(doses);
    setDose(recommended);
    setTiming(drug.timing?.[0] || "");
    setDuration(drug.duration?.[1] || drug.duration?.[0] || "");
    setForm(drug.forms?.[0] || "");
    setNote(drug.note || "");
    setWarnings(getWarnings(drug, patient));
  }

  function getFrequency(t) {
    if (!t) return 1;
    const lower = t.toLowerCase();
    if (lower.includes("once")) return 1;
    if (lower.includes("twice") || lower.includes("12 hours")) return 2;
    if (lower.includes("three") || lower.includes("8 hours")) return 3;
    if (lower.includes("four") || lower.includes("6 hours")) return 4;
    return 1;
  }

  function doAdd() {
    // Strict English Check
    const arabicPattern = /[\u0600-\u06FF]/;
    if (arabicPattern.test(query) || arabicPattern.test(dose) || arabicPattern.test(timing) || arabicPattern.test(duration) || arabicPattern.test(note)) {
      alert("Arabic characters are NOT allowed in the prescription. Please use English only.");
      return;
    }

    onAdd({ 
      name: selected.name, form, dose, timing, duration, note,
      doseOptions: dosesOptions.length ? dosesOptions : [dose],
      timingOptions: selected.timing?.length ? selected.timing : [timing],
      durationOptions: selected.duration?.length ? selected.duration : [duration],
    });
    setQuery(""); setSelected(null); setDose(""); setTiming("");
    setDuration(""); setForm(""); setNote(""); setWarnings([]);
  }

  function handleAdd() {
    if (!selected) return;
    
    // Safety Check: Max Daily Dose
    const numericDose = parseFloat(dose.replace(/[^\d.]/g, "")) || 0;
    const freq = getFrequency(timing);
    const totalDaily = numericDose * freq;
    const maxSafe = selected.max_daily_dose || 0;

    if (maxSafe > 0) {
      if (totalDaily >= maxSafe) {
        alert(`❌ DANGER: Total daily dose (${totalDaily}mg) equals or exceeds safety limit (${maxSafe}mg). THE PATIENT MIGHT DIE! Please reduce the dose or frequency.`);
        return;
      }
      if (totalDaily >= (maxSafe / 2)) {
        setConfirmData({
          show: true,
          message: `⚠️ WARNING: Total daily dose (${totalDaily}mg) is half or more of the safety limit (${maxSafe}mg). Are you sure you want to proceed?`,
          onConfirm: () => {
             setConfirmData({ show: false });
             doAdd();
          }
        });
        return;
      }
    }
    doAdd();
  }

  const [allDrugs, setAllDrugs] = useState([]);
  const [filterCat, setFilterCat] = useState("");
  const [pendingDrugs, setPendingDrugs] = useState([]); // multi-select from favorites

  useEffect(() => {
    getDrugs("").then(setAllDrugs).catch(console.error);
  }, []);

  const favorites = allDrugs.filter(d => d.is_favorite && (filterCat === "" || d.category === filterCat));
  
  // Dynamic categories based on actual database entries
  const availableCategories = [...new Set(allDrugs.map(d => d.category).filter(Boolean))];

  // Filter search results locally
  const searchResults = (query.trim() ? suggestions : []).filter(d => filterCat === "" || d.category === filterCat);

  // Toggle a drug in/out of the pending (multi-select) list
  const togglePending = (drug) => {
    setPendingDrugs(prev => {
      const exists = prev.find(d => d.id === drug.id);
      if (exists) return prev.filter(d => d.id !== drug.id);
      return [...prev, drug];
    });
  };

  // Add all pending drugs to prescription at once
  const addAllPending = () => {
    if (pendingDrugs.length === 0) return;
    const drugsToAdd = pendingDrugs.map(drug => {
      const { recommended, doses } = calcDose(drug, patient);
      return {
        name: drug.name,
        form: drug.forms?.[0] || "",
        dose: recommended || doses[0] || "",
        timing: drug.timing?.[0] || "",
        duration: drug.duration?.[1] || drug.duration?.[0] || "",
        note: drug.note || "",
        doseOptions: doses.length ? doses : [recommended || doses[0]],
        timingOptions: drug.timing?.length ? drug.timing : [],
        durationOptions: drug.duration?.length ? drug.duration : [],
      };
    });
    onAdd(drugsToAdd);
    setPendingDrugs([]);
  };

  const handleSelect = (drug) => {
    selectDrug(drug);
    setShowSug(false);
  };

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="animate-fade" style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 20, minHeight: 450 }}>
      {/* Left Column: Favorites List (Multi-Select) */}
      <div className="glass-panel" style={{ flex: 1, padding: 20, display: "flex", flexDirection: "column", border: pendingDrugs.length > 0 ? "1px solid var(--primary)" : "1px solid rgba(0, 210, 255, 0.1)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            ⭐ {t("قائمة العلاجات المفضلة")} {filterCat && <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.6 }}>({filterCat})</span>}
          </h3>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{favorites.length} {t("دواء")}</div>
        </div>

        {/* Multi-select hint */}
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
          <span>💡</span>
          <span>{t("انقر لتحديد أكثر من علاج ثم اضغط إضافة الكل")}</span>
        </div>
        
        <div className="custom-scrollbar" style={{ 
          flex: 1, 
          overflowY: "auto", 
          maxHeight: isMobile ? "35vh" : "50vh",
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", 
          gap: 10, 
          paddingRight: 4 
        }}>
          {favorites.length > 0 ? (
            favorites.map(d => {
              const isPending = pendingDrugs.find(p => p.id === d.id);
              return (
                <div 
                  key={d.id} 
                  onClick={() => togglePending(d)}
                  style={{ 
                    padding: 10, borderRadius: 10, position: "relative",
                    background: isPending ? "var(--primary)" : "rgba(255,255,255,0.02)", 
                    border: isPending ? "2px solid var(--primary)" : "1px solid rgba(255,255,255,0.08)", 
                    cursor: "pointer", transition: "all 0.15s",
                    transform: isPending ? "scale(1.02)" : "scale(1)",
                  }}
                >
                  {isPending && (
                    <div style={{ position: "absolute", top: 6, right: 6, background: "white", color: "var(--primary)", borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900 }}>✓</div>
                  )}
                  <div style={{ fontWeight: 700, fontSize: 12, color: isPending ? "white" : "inherit", paddingRight: isPending ? 18 : 0 }}>{d.name}</div>
                  <div style={{ fontSize: 10, color: isPending ? "rgba(255,255,255,0.7)" : "var(--text-muted)" }}>{d.category}</div>
                </div>
              );
            })
          ) : (
            <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 40, color: "var(--text-muted)", fontSize: 12 }}>
              {filterCat ? t("لا يوجد مفضلات في هذا التصنيف") : t("لا يوجد أدوية مفضلة بعد")}
            </div>
          )}
        </div>

        {/* Add All Button */}
        {pendingDrugs.length > 0 && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
              {pendingDrugs.map(d => (
                <span key={d.id} style={{ fontSize: 11, background: "rgba(255,255,255,0.1)", padding: "2px 8px", borderRadius: 10, display: "flex", alignItems: "center", gap: 4 }}>
                  {d.name}
                  <span onClick={() => togglePending(d)} style={{ cursor: "pointer", color: "#ef4444", fontWeight: 700 }}>×</span>
                </span>
              ))}
            </div>
            <button 
              className="btn-primary" 
              style={{ width: "100%", padding: "10px", fontWeight: 700, fontSize: 14 }} 
              onClick={addAllPending}
            >
              ➕ {t("إضافة")} {pendingDrugs.length} {t("علاجات للوصفة")}
            </button>
          </div>
        )}
        
        {selected && (
           <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.1)", animation: "slideUp 0.3s ease" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontWeight: 700, color: "var(--primary)", fontSize: 14 }}>{selected.name}</span>
                  <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{selected.category}</span>
                </div>
                <span style={{ fontSize: 10, background: "rgba(0, 210, 255, 0.1)", color: "var(--primary)", padding: "2px 8px", borderRadius: 4, fontWeight: 700 }}>{form}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                 <div>
                   <label style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4, display: "block" }}>{t("الجرعة")}</label>
                   <select className="glass-input" style={{ width: "100%", padding: "6px 10px", fontSize: 11 }} value={dose} onChange={e => setDose(e.target.value)}>
                      {dosesOptions.map(o => <option key={o}>{o}</option>)}
                      {!dosesOptions.includes(dose) && dose && <option>{dose}</option>}
                   </select>
                 </div>
                 <div>
                   <label style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4, display: "block" }}>{t("التكرار")}</label>
                   <select className="glass-input" style={{ width: "100%", padding: "6px 10px", fontSize: 11 }} value={timing} onChange={e => setTiming(e.target.value)}>
                      {selected.timing?.map(t => <option key={t}>{t}</option>)}
                   </select>
                 </div>
              </div>
              <button className="btn-primary" style={{ width: "100%", marginTop: 12, padding: "10px", fontWeight: 700 }} onClick={handleAdd}>
                {t("إضافة للوصفة")}
              </button>
           </div>
        )}
      </div>

      {/* Right Column: Filters (Narrower) */}
      <div style={{ width: isMobile ? "100%" : 280, display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="glass-panel" style={{ padding: 16 }}>
          <label style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, display: "block" }}>{t("تصنيف العلاجات")}</label>
          <select className="glass-input" style={{ width: "100%", padding: 8, fontSize: 12 }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
            <option value="">{t("الكل")}</option>
            {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="glass-panel" style={{ padding: 16, flex: 1, display: "flex", flexDirection: "column" }}>
          <label style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, display: "block" }}>{t("بحث شامل")}</label>
          <input 
            className="glass-input" 
            style={{ width: "100%", marginBottom: 12, padding: 8, fontSize: 12 }} 
            placeholder={t("بحث باسم العلاج...")} 
            value={query}
            onChange={e => setQuery(e.target.value)}
          />

          <div className="custom-scrollbar" style={{ flex: 1, overflowY: "auto" }}>
            {searchResults.map(d => (
              <div 
                key={d.id} 
                onClick={() => handleSelect(d)}
                style={{ 
                  padding: "8px 12px", cursor: "pointer", borderRadius: 8, marginBottom: 6,
                  background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)",
                  transition: "background 0.2s"
                }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
              >
                <div style={{ fontWeight: 600, fontSize: 12 }}>{d.name}</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{d.category}</div>
              </div>
            ))}
            {query.trim() && searchResults.length === 0 && (
              <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 11, paddingTop: 20 }}>{t("لا يوجد نتائج")}</div>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal 
        show={confirmData.show} 
        title={t("تأكيد الجرعة العالية")} 
        message={confirmData.message} 
        danger={true}
        onConfirm={confirmData.onConfirm} 
        onCancel={() => setConfirmData({ ...confirmData, show: false })} 
      />
    </div>
  );
}
