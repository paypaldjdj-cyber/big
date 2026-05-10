import { useState, useRef } from "react";
import { useLanguage } from "../LanguageContext";
import { updatePatient } from "../api";

export default function CasePresentation({ patientId, initialData = {} }) {
  const { t } = useLanguage();
  const [data, setData] = useState({
    doctor: initialData.case_doctor || "",
    ur: initialData.quad_ur || "",
    ul: initialData.quad_ul || "",
    lr: initialData.quad_lr || "",
    ll: initialData.quad_ll || "",
    notes: initialData.case_notes || [],
    images: initialData.case_images || []
  });
  const fileRef = useRef();

  const save = async () => {
    try {
      await updatePatient(patientId, {
        case_doctor: data.doctor,
        quad_ur: data.ur,
        quad_ul: data.ul,
        quad_lr: data.lr,
        quad_ll: data.ll,
        case_notes: data.notes,
        case_images: data.images
      });
      alert(t("تم الحفظ بنجاح ✓"));
    } catch (err) {
      alert(t("حدث خطأ"));
    }
  };

  const onFiles = (e) => {
    Array.from(e.target.files).forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => setData(prev => ({
        ...prev, 
        images: [...prev.images, { src: ev.target.result, desc: "" }]
      }));
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="animate-fade">
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700 }}>{t("عرض الحالة")}</h3>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={() => window.print()} className="btn-ghost" style={{ fontSize: 12 }}>🖨 {t("طباعة")}</button>
          <button onClick={save} className="btn-primary" style={{ fontSize: 12 }}>{t("حفظ البيانات")}</button>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: 24, marginBottom: 24 }}>
        <label style={lblStyle}>{t("طبيب الحالة")}</label>
        <input className="glass-input" style={{ width: "100%", maxWidth: 300 }} value={data.doctor} onChange={e => setData({...data, doctor: e.target.value})} />
      </div>

      {/* Jaw Quadrants */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, background: "var(--glass-border)", padding: 1, borderRadius: 12, marginBottom: 24, overflow: "hidden" }}>
        <QuadInput label="Upper Right" val={data.ur} onChange={v => setData({...data, ur: v})} />
        <QuadInput label="Upper Left" val={data.ul} onChange={v => setData({...data, ul: v})} />
        <QuadInput label="Lower Right" val={data.lr} onChange={v => setData({...data, lr: v})} />
        <QuadInput label="Lower Left" val={data.ll} onChange={v => setData({...data, ll: v})} />
      </div>

      {/* Case Images */}
      <div className="glass-panel" style={{ padding: 24 }}>
        <h4 style={{ fontSize: 14, marginBottom: 16 }}>{t("صور الحالة")}</h4>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
          {data.images.map((img, i) => (
            <div key={i} style={{ width: 120, position: "relative" }}>
              <img src={img.src} style={{ width: "100%", height: 100, objectFit: "cover", borderRadius: 8 }} />
              <button onClick={() => setData({...data, images: data.images.filter((_, j) => j !== i)})} style={{ position: "absolute", top: -8, right: -8, width: 20, height: 20, borderRadius: "50%", background: "var(--danger)", border: "none", color: "white", cursor: "pointer" }}>×</button>
            </div>
          ))}
          <div onClick={() => fileRef.current.click()} style={{ width: 120, height: 100, border: "2px dashed var(--glass-border)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 24 }}>+</div>
        </div>
        <input ref={fileRef} type="file" multiple hidden onChange={onFiles} />
      </div>
    </div>
  );
}

const QuadInput = ({ label, val, onChange }) => (
  <div style={{ background: "var(--bg-card)", padding: 16 }}>
    <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase" }}>{label}</div>
    <textarea className="glass-input" style={{ width: "100%", minHeight: 80, fontSize: 13 }} value={val} onChange={e => onChange(e.target.value)} />
  </div>
);

const lblStyle = { display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 6 };
