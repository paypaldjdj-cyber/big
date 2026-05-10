import { useEffect, useState } from "react";
import { getClinics, addClinic, deleteClinic } from "../api";
import { useLanguage } from "../LanguageContext";

export default function SystemAdmin() {
  const { t } = useLanguage();
  const [list,  setList]  = useState([]);
  const [modal, setModal] = useState(false);
  const [form,  setForm]  = useState({ name: "", doctor: "", code: "", expiry: "" });

  const load = () => getClinics().then(setList).catch(console.error);
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name || !form.code) return alert("Missing fields");
    await addClinic(form).catch(console.error);
    setModal(false); load();
  };

  return (
    <div style={{ minHeight: "100vh", background: "#020617", color: "white", padding: 40, fontFamily: "system-ui" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 40 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>Company Dashboard 🏢</h1>
            <p style={{ color: "#94a3b8", fontSize: 14 }}>Manage your clinics and licenses globally</p>
          </div>
          <button onClick={() => setModal(true)} style={{ 
            background: "white", color: "black", border: "none", padding: "12px 24px", 
            borderRadius: 12, fontWeight: 700, cursor: "pointer" 
          }}>+ Register Clinic</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, marginBottom: 40 }}>
          <AdminStat label="Total Clinics" val={list.length} />
          <AdminStat label="Active Subscriptions" val={list.filter(c => c.status === "Active").length} />
          <AdminStat label="Global Revenue" val="$12,400" />
        </div>

        <div style={{ background: "#1e293b", borderRadius: 16, border: "1px solid #334155", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#0f172a", textAlign: "left" }}>
                {["Clinic Name", "Doctor", "Access Code", "Expiry", "Status", "Actions"].map(h => (
                  <th key={h} style={{ padding: "16px 20px", fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map(c => (
                <tr key={c.id} style={{ borderBottom: "1px solid #334155" }}>
                  <td style={{ padding: "16px 20px", fontWeight: 600 }}>{c.name}</td>
                  <td style={{ padding: "16px 20px", color: "#cbd5e1" }}>{c.doctor}</td>
                  <td style={{ padding: "16px 20px" }}><code style={{ background: "#020617", padding: "4px 8px", borderRadius: 6 }}>{c.code}</code></td>
                  <td style={{ padding: "16px 20px", fontSize: 13 }}>{c.expiry}</td>
                  <td style={{ padding: "16px 20px" }}>
                    <span style={{ 
                      fontSize: 11, padding: "4px 10px", borderRadius: 20, 
                      background: c.status === "Active" ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
                      color: c.status === "Active" ? "#10b981" : "#ef4444"
                    }}>{c.status}</span>
                  </td>
                  <td style={{ padding: "16px 20px" }}>
                    <button onClick={() => deleteClinic(c.id).then(load)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer" }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#1e293b", padding: 40, borderRadius: 20, width: 450, border: "1px solid #334155" }}>
            <h3 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>New Clinic Registration</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <input style={adminInp} placeholder="Clinic Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              <input style={adminInp} placeholder="Doctor Name" value={form.doctor} onChange={e => setForm({...form, doctor: e.target.value})} />
              <input style={adminInp} placeholder="Activation Code" value={form.code} onChange={e => setForm({...form, code: e.target.value})} />
              <input style={adminInp} type="date" value={form.expiry} onChange={e => setForm({...form, expiry: e.target.value})} />
              <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
                <button onClick={() => setModal(false)} style={{ flex: 1, padding: 12, borderRadius: 10, background: "transparent", border: "1px solid #334155", color: "white" }}>Cancel</button>
                <button onClick={save} style={{ flex: 1, padding: 12, borderRadius: 10, background: "white", color: "black", fontWeight: 700, border: "none" }}>Register</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const AdminStat = ({ label, val }) => (
  <div style={{ background: "#1e293b", padding: 24, borderRadius: 16, border: "1px solid #334155" }}>
    <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 8 }}>{label}</div>
    <div style={{ fontSize: 24, fontWeight: 800 }}>{val}</div>
  </div>
);

const adminInp = { background: "#0f172a", border: "1px solid #334155", padding: 14, borderRadius: 10, color: "white", width: "100%", outline: "none" };
