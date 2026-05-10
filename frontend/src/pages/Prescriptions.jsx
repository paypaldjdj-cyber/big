import { useEffect, useState } from "react";
import { useLanguage } from "../LanguageContext";
import { getAllPrescriptions, deletePrescription, getPrescriptionPDFUrl, getSettings } from "../api";
import { useNavigate } from "react-router-dom";
import PrescriptionModal from "../components/PrescriptionModal";
import ConfirmModal from "../components/ConfirmModal";

export default function Prescriptions() {
  const { t } = useLanguage();
  const [list, setList] = useState([]);
  const [settings, setSettings] = useState({});
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [confirmData, setConfirmData] = useState({ show: false, message: "", onConfirm: null });
  const nav = useNavigate();

  const load = () => {
    getAllPrescriptions().then(setList).catch(console.error);
    getSettings().then(setSettings).catch(console.error);
  };
  useEffect(() => { load(); }, []);

  const handleDelete = (id) => {
    setConfirmData({
      show: true,
      message: t("هل أنت متأكد من حذف هذه الوصفة؟"),
      onConfirm: async () => {
        setConfirmData({ show: false });
        await deletePrescription(id);
        load();
      }
    });
  };

  const patientsMap = list.reduce((acc, curr) => {
    if (!acc[curr.patient_id]) {
      acc[curr.patient_id] = { id: curr.patient_id, name: curr.patient_name, prescriptions: [] };
    }
    acc[curr.patient_id].prescriptions.push(curr);
    return acc;
  }, {});
  const patientsList = Object.values(patientsMap).filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase())
  );


  return (
    <div className="animate-fade">
      <div className="presc-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>{t("سجل الوصفات الطبية")}</h2>
        
        {!selectedPatient && (
          <div className="search-box" style={{ position: "relative", width: 300 }}>
            <input 
              type="text" 
              className="glass-input" 
              style={{ width: "100%", paddingLeft: 40 }} 
              placeholder={t("بحث باسم المريض...")}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <span style={{ position: "absolute", left: 15, top: "50%", transform: "translateY(-50%)", opacity: 0.5 }}>🔍</span>
          </div>
        )}
      </div>

      {!selectedPatient ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
          {patientsList.map(p => (
            <div key={p.id} className="glass-panel" style={{ padding: 24, cursor: "pointer", transition: "transform 0.2s" }} 
                 onClick={() => setSelectedPatient(p)}
                 onMouseEnter={e => e.currentTarget.style.transform = "translateY(-4px)"}
                 onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>👤</div>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>{p.name}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{p.prescriptions.length} {t("وصفات مسجلة")}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="animate-fade">
          <button onClick={() => setSelectedPatient(null)} className="btn-ghost" style={{ marginBottom: 24 }}>← {t("رجوع لقائمة المرضى")}</button>
          <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: 20, fontWeight: 700 }}>{t("وصفات")} — {selectedPatient.name}</h3>
            <button onClick={() => nav(`/patients/${selectedPatient.id}`)} className="btn-primary" style={{ fontSize: 12 }}>{t("فتح الملف الشخصي")}</button>
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 24 }}>
            {selectedPatient.prescriptions.map(pr => (
              <PrescriptionCard key={pr.id} pr={pr} settings={settings} onClick={() => setEditing(pr)} />
            ))}
          </div>
        </div>
      )}

      {editing && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div className="glass-panel animate-fade" style={{ width: "100%", maxWidth: 650, padding: "20px 32px", maxHeight: "95vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ fontSize: 20 }}>Prescription Preview</h3>
              <button onClick={() => setEditing(null)} className="btn-ghost" style={{ fontSize: 20, padding: "0 10px" }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              <PrescriptionModal 
                patient={{ id: editing.patient_id, first_name: editing.patient_name.split(' ')[0], last_name: editing.patient_name.split(' ')[1] || '', age: editing.age }} 
                onClose={() => setEditing(null)} 
                onRefresh={load} 
                existingData={editing} 
              />
            </div>
          </div>
        </div>
      )}

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

function PrescriptionCard({ pr, settings, onClick }) {
  const { t } = useLanguage();
  const drugs = pr.drugs_json ? JSON.parse(pr.drugs_json) : [];

  return (
    <div className="glass-panel" style={{ padding: 16, cursor: "pointer", transition: "all 0.2s" }} onClick={onClick}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12, display: "flex", justifyContent: "space-between" }}>
        <span>{pr.date}</span>
        <span style={{ fontSize: 9 }}>#{pr.rx_number}</span>
      </div>
      
      <div style={{ 
        width: "100%", 
        aspectRatio: "1 / 1.414", 
        background: "white", 
        borderRadius: 4, 
        overflow: "hidden", 
        position: "relative",
        boxShadow: "0 4px 15px rgba(0,0,0,0.4)",
        border: "1px solid rgba(0,0,0,0.1)"
      }}>
        {/* Miniature Paper Content */}
        <div style={{ 
          padding: "10px",
          color: "black",
          background: "white",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          fontSize: "8px",
          lineHeight: "1.2"
        }}>
          {/* Header */}
          <div style={{ width: "100%", height: "15%", borderBottom: "0.5px solid #eee", marginBottom: "5%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {settings.prescription_header ? (
              <img src={settings.prescription_header} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            ) : (
              <div style={{ fontSize: "6px", color: "#ccc" }}>SmileCare Clinic</div>
            )}
          </div>
          
          <div style={{ fontWeight: 700, marginBottom: "2%" }}>Name: {pr.patient_name || "Patient"}</div>
          <div style={{ fontSize: "7px", color: "#666", marginBottom: "5%" }}>Date: {pr.date}</div>
          
          <div style={{ fontSize: "20px", fontWeight: 900, color: "#185FA5", marginBottom: "5%", marginTop: "2%" }}>Rx</div>
          
          <div style={{ flex: 1 }}>
            {drugs.slice(0, 4).map((d, i) => (
              <div key={i} style={{ marginBottom: "3%", fontSize: "8px", borderBottom: "0.2px solid #f9f9f9" }}>
                • <b>{d.name}</b> {d.dose}
              </div>
            ))}
            {drugs.length > 4 && <div style={{ fontSize: "6px", fontStyle: "italic" }}>+{drugs.length - 4} more...</div>}
          </div>
          
          {/* Footer */}
          <div style={{ width: "100%", height: "10%", borderTop: "0.5px solid #eee", marginTop: "auto" }}>
             {settings.prescription_footer && <img src={settings.prescription_footer} style={{ width: "100%", height: "100%", objectFit: "contain" }} />}
          </div>
        </div>
      </div>
      
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
        <button onClick={async (e) => {
          e.stopPropagation();
          const url = getPrescriptionPDFUrl(pr.id);
          const user = JSON.parse(localStorage.getItem("clinic_user") || "{}");
          const res = await fetch(url, { headers: { "Authorization": `Bearer ${user.token}` } });
          const blob = await res.blob();
          window.open(URL.createObjectURL(blob), "_blank");
        }} className="btn-ghost" style={{ fontSize: 11, padding: "4px 12px", border: "1px solid rgba(255,255,255,0.1)" }}>🖨 Print</button>
      </div>
    </div>
  );
}
