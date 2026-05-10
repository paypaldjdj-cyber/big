import React, { useState, useEffect, useRef } from "react";
import { getDrugs, addDrug, deleteDrug, updateDrug, toggleFavoriteDrug } from "../api";
import { useLanguage } from "../LanguageContext";
import ConfirmModal from "./ConfirmModal";

const CATEGORIES = [
  "Analgesics",
  "Antibiotics",
  "Anti-inflammatories",
  "Antivirals & Antifungals",
  "Corticosteroids",
  "Others"
];

const PHARMA_FORMS = [
  "Tablets", "Capsules", "Syrup", "Injection", "Drops", "Ointment", "Cream", "Gel", "Suppositories", "Spray", "Patch", "Mouthwash"
];

const TIMINGS = [
  "Once daily",
  "Twice daily",
  "Three times daily",
  "Four times daily",
  "Every 8 hours",
  "Every 12 hours",
  "As needed"
];

const DURATIONS = [
  "1 day", "2 days", "3 days", "4 days", "5 days", "7 days", "10 days", "14 days"
];

export default function DrugManagement() {
  const { t } = useLanguage();
  const [drugs, setDrugs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [confirmData, setConfirmData] = useState({ show: false, message: "", onConfirm: null });
  const formRef = useRef(null);
  
  const [newDrug, setNewDrug] = useState({
    name: "", category: "", forms: [], doseValue: "", max_daily_dose: "", timing: "", duration: "",
    note: "", warn_pregnant: "", warn_breastfeed: "", warn_renal: "", warn_hepatic: "",
    warn_allergy: "", warn_diabetes: "", warn_blood_pressure: ""
  });

  const load = async () => {
    try {
      const res = await getDrugs(query);
      setDrugs(res);
    } catch(e) { console.error(e); }
  };


  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [query]);

  const toggleForm = (form) => {
    setNewDrug(prev => {
      const isSelected = prev.forms.includes(form);
      return { ...prev, forms: isSelected ? prev.forms.filter(f => f !== form) : [...prev.forms, form] };
    });
  };

  const getUnit = () => {
    if (newDrug.forms.length === 0) return "";
    const mainForm = newDrug.forms[0];
    if (["Tablets", "Capsules", "Suppositories"].includes(mainForm)) return "mg";
    if (["Syrup", "Injection", "Drops", "Mouthwash"].includes(mainForm)) return "ml";
    if (["Ointment", "Cream", "Gel"].includes(mainForm)) return "%";
    return "";
  };

  const [activeList, setActiveList] = useState("favorites"); // favorites or all

  const toggleFav = async (id) => {
    try {
      await toggleFavoriteDrug(id);
      load();
    } catch(e) { console.error(e); }
  };

  const handleSave = async () => {
    if(!newDrug.name) return;
    setLoading(true);
    try {
      const fullDose = newDrug.doseValue ? `${newDrug.doseValue}${getUnit()}` : "";
      const payload = {
        ...newDrug,
        max_daily_dose: parseFloat(newDrug.max_daily_dose) || 0,
        is_favorite: newDrug.is_favorite ? 1 : 0,
        doses_adult: [fullDose].filter(Boolean),
        timing: [newDrug.timing].filter(Boolean),
        duration: [newDrug.duration].filter(Boolean),
      };
      
      if (editingId) {
        await updateDrug(editingId, payload);
        setEditingId(null);
      } else {
        await addDrug(payload);
      }
      
      setNewDrug({ 
        name: "", category: "", forms: [], doseValue: "", max_daily_dose: "", timing: "", duration: "", note: "", 
        warn_pregnant: "", warn_breastfeed: "", warn_renal: "", warn_hepatic: "",
        warn_allergy: "", warn_diabetes: "", warn_blood_pressure: "", is_favorite: false
      });
      load();
    } catch(e) { alert(e.message); } finally { setLoading(false); }
  };

  const handleEdit = (d) => {
    setEditingId(d.id);
    setNewDrug({
      name: d.name || "",
      category: d.category || "",
      forms: d.forms || [],
      doseValue: d.doses?.adult?.[0]?.replace(/[^\d.\-]/g, '').trim() || "",
      max_daily_dose: d.max_daily_dose || "",
      is_favorite: d.is_favorite || false,
      timing: d.timing?.[0] || "",
      duration: d.duration?.[0] || "",
      note: d.note || "",
      warn_pregnant: d.warnings?.pregnant || "",
      warn_breastfeed: d.warnings?.breastfeed || "",
      warn_renal: d.warnings?.renal || "",
      warn_hepatic: d.warnings?.hepatic || "",
      warn_allergy: d.warnings?.allergy || "",
      warn_diabetes: d.warnings?.diabetes || "",
      warn_blood_pressure: d.warnings?.blood_pressure || ""
    });
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setNewDrug({ 
      name: "", category: "", forms: [], doseValue: "", max_daily_dose: "", timing: "", duration: "", note: "", 
      warn_pregnant: "", warn_breastfeed: "", warn_renal: "", warn_hepatic: "",
      warn_allergy: "", warn_diabetes: "", warn_blood_pressure: "", is_favorite: false
    });
  };

  const handleRemove = (id) => {
    setConfirmData({
      show: true,
      message: t("هل أنت متأكد من حذف هذا الدواء؟"),
      onConfirm: async () => {
        setConfirmData({ show: false });
        await deleteDrug(id);
        load();
      }
    });
  };

  const filteredDrugs = drugs.filter(d => {
    const matchCat = filterCategory === "" || d.category === filterCategory;
    if (activeList === "favorites") return d.is_favorite && matchCat;
    return matchCat;
  });

  return (
    <div className="animate-fade" style={{ direction: "ltr", textAlign: "left" }} ref={formRef}>
      <div className="glass-panel" style={{ padding: 0, marginBottom: 32, overflow: "hidden", border: editingId ? "2px solid var(--primary)" : "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ background: editingId ? "var(--primary)" : "rgba(255,255,255,0.05)", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: editingId ? "white" : "inherit" }}>
            {editingId ? t("تعديل بيانات الدواء") : t("إضافة دواء جديد للقاعدة")}
          </h3>
          {!editingId && (
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: "var(--text-muted)", fontSize: 13 }}>
              <input type="checkbox" checked={newDrug.is_favorite} onChange={e => setNewDrug({...newDrug, is_favorite: e.target.checked})} />
              ⭐ {t("إضافة للمفضلة مباشرة")}
            </label>
          )}
        </div>

        <div style={{ padding: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 20, marginBottom: 24 }}>
            <div>
              <label style={lblStyle}>{t("اسم الدواء")} *</label>
              <input className="glass-input" style={{ width: "100%" }} value={newDrug.name} onChange={e => setNewDrug({...newDrug, name: e.target.value})} placeholder="Amoxicillin..." />
            </div>
            <div>
              <label style={lblStyle}>{t("التصنيف")}</label>
              <select className="glass-input" style={{ width: "100%", padding: 10 }} value={newDrug.category} onChange={e => setNewDrug({...newDrug, category: e.target.value})}>
                <option value="">{t("اختر التصنيف...")}</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ ...lblStyle, marginBottom: 12 }}>{t("الأشكال الصيدلانية")}</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {PHARMA_FORMS.map(form => (
                <button key={form} onClick={() => toggleForm(form)} style={{
                    padding: "8px 16px", borderRadius: "12px", fontSize: 13, cursor: "pointer", border: "1px solid", transition: "all 0.2s",
                    borderColor: newDrug.forms.includes(form) ? "var(--primary)" : "rgba(255,255,255,0.1)",
                    background: newDrug.forms.includes(form) ? "var(--primary)" : "rgba(255,255,255,0.03)",
                    color: newDrug.forms.includes(form) ? "white" : "var(--text-muted)",
                  }}> {form} </button>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20, marginBottom: 32, padding: 20, background: "rgba(255,255,255,0.02)", borderRadius: 16 }}>
            <div>
              <label style={lblStyle}>{t("الجرعة")}</label>
              <div style={{ display: "flex", alignItems: "center" }}>
                <input type="number" className="glass-input" style={{ width: "100%", borderTopRightRadius: 0, borderBottomRightRadius: 0 }} value={newDrug.doseValue} onChange={e => setNewDrug({...newDrug, doseValue: e.target.value})} placeholder="500" />
                <div style={{ background: "rgba(255,255,255,0.1)", padding: "10px 14px", border: "1px solid rgba(255,255,255,0.2)", borderLeft: "none", borderTopRightRadius: 8, borderBottomRightRadius: 8, minWidth: 50, textAlign: "center", fontWeight: 700 }}>
                  {getUnit() || "--"}
                </div>
              </div>
            </div>
            <div>
              <label style={lblStyle}>{t("التكرار")}</label>
              <select className="glass-input" style={{ width: "100%", padding: 10 }} value={newDrug.timing} onChange={e => setNewDrug({...newDrug, timing: e.target.value})}>
                <option value="">{t("اختر...")}</option>
                {TIMINGS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={lblStyle}>{t("المدة")}</label>
              <select className="glass-input" style={{ width: "100%", padding: 10 }} value={newDrug.duration} onChange={e => setNewDrug({...newDrug, duration: e.target.value})}>
                <option value="">{t("اختر...")}</option>
                {DURATIONS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label style={lblStyle}>{t("الجرعة اليومية القصوى (ملغ)")}</label>
              <input type="number" className="glass-input" style={{ width: "100%" }} value={newDrug.max_daily_dose} onChange={e => setNewDrug({...newDrug, max_daily_dose: e.target.value})} placeholder="4000" />
            </div>
          </div>

          <div style={{ border: "1px solid rgba(239,68,68,0.2)", borderRadius: 16, padding: 20, background: "rgba(239,68,68,0.02)" }}>
            <h4 style={{ fontSize: 14, marginTop: 0, marginBottom: 20, color: "#ef4444" }}>⚠️ {t("تحذيرات وحالات خاصة")}</h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
              {["warn_pregnant", "warn_breastfeed", "warn_renal", "warn_hepatic", "warn_allergy", "warn_diabetes", "warn_blood_pressure"].map(w => (
                <div key={w}>
                  <label style={warnLblStyle}>{t(w)}</label>
                  <input className="glass-input warn-input" value={newDrug[w]} onChange={e => setNewDrug({...newDrug, [w]: e.target.value})} />
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 32 }}>
            <button className="btn-primary" onClick={handleSave} disabled={loading || !newDrug.name} style={{ padding: "12px 40px", fontSize: 16 }}>
              {loading ? t("جاري الحفظ...") : editingId ? t("تحديث") : t("حفظ")}
            </button>
            {editingId && <button className="btn-secondary" onClick={cancelEdit} style={{ padding: "12px 24px" }}> {t("إلغاء")} </button>}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <button 
            onClick={() => setActiveList("favorites")}
            className={activeList === "favorites" ? "btn-primary" : "btn-ghost"}
            style={{ padding: "10px 24px", borderRadius: 12 }}
          > ⭐ {t("المفضلة")} </button>
          <button 
            onClick={() => setActiveList("all")}
            className={activeList === "all" ? "btn-primary" : "btn-ghost"}
            style={{ padding: "10px 24px", borderRadius: 12 }}
          > 📦 {t("كافة الأدوية")} </button>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <select className="glass-input" style={{ width: 180 }} value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
            <option value="">{t("كافة التصنيفات")}</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input className="glass-input" style={{ width: 200 }} placeholder={t("بحث...")} value={query} onChange={e => setQuery(e.target.value)} />
        </div>
      </div>

      <div className="table-container">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", textAlign: "left" }}>
              <th style={{ padding: 12, color: "var(--text-muted)", fontSize: 12 }}>{t("الحالة")}</th>
              <th style={{ padding: 12, color: "var(--text-muted)", fontSize: 12 }}>{t("الاسم والتصنيف")}</th>
              <th style={{ padding: 12, color: "var(--text-muted)", fontSize: 12 }}>{t("الجرعة والنمط")}</th>
              <th style={{ padding: 12, color: "var(--text-muted)", fontSize: 12 }}>{t("الإجراءات")}</th>
            </tr>
          </thead>
          <tbody>
            {filteredDrugs.map(d => (
              <tr key={d.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <td style={{ padding: 12 }}>
                  <button onClick={() => toggleFav(d.id)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer" }}>
                    {d.is_favorite ? "⭐" : "☆"}
                  </button>
                </td>
                <td style={{ padding: 12 }}>
                  <div style={{ fontWeight: 600 }}>{d.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{d.category || "—"}</div>
                </td>
                <td style={{ padding: 12, fontSize: 12 }}>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 4 }}>
                    {(d.forms || []).map(f => <span key={f} style={{background: "rgba(255,255,255,0.1)", padding: "2px 6px", borderRadius: 4}}>{f}</span>)}
                  </div>
                  <div style={{ color: "var(--primary)", fontWeight: "bold" }}>{d.doses?.adult?.[0]}</div>
                </td>
                <td style={{ padding: 12, width: 160 }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => handleEdit(d)} className="btn-ghost" style={{ color: "var(--primary)", padding: "4px 12px", border: "1px solid rgba(255,255,255,0.1)", fontSize: 12 }}>{t("تعديل")}</button>
                    <button onClick={() => handleRemove(d.id)} className="btn-ghost" style={{ color: "#ef4444", padding: "4px 12px", border: "1px solid rgba(239,68,68,0.2)", fontSize: 12 }}>{t("حذف")}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredDrugs.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
            {activeList === "favorites" ? t("لا توجد أدوية مفضلة بعد. يمكنك إضافة أدوية من القائمة الشاملة.") : t("لا توجد أدوية مطابقة للبحث.")}
          </div>
        )}
      </div>

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

const lblStyle = { fontSize: 12, color: "var(--text-muted)", marginBottom: 6, display: "block", fontWeight: 600 };
const warnLblStyle = { fontSize: 11, color: "#991b1b", marginBottom: 4, display: "block", fontWeight: 700 };
