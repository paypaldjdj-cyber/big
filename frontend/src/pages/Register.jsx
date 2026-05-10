import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { register } from "../api";
import { useLanguage } from "../LanguageContext";

export default function Register() {
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    clinic_name: ""
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const { t } = useLanguage();
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!formData.username || !formData.password || !formData.clinic_name) {
      setError("يرجى ملء جميع الحقول");
      return;
    }
    setLoading(true);
    setError(null);
    const submitData = { ...formData, username: formData.username.trim() };
    try {
      await register(submitData);
      alert("تم إنشاء الحساب بنجاح! يمكنك الآن تسجيل الدخول.");
      navigate("/login");
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ 
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg-dark)", position: "relative", overflow: "hidden" 
    }}>
      <div style={{ 
        position: "absolute", top: "-10%", left: "-10%", width: "40vw", height: "40vw", 
        background: "radial-gradient(circle, rgba(24, 95, 165, 0.15) 0%, transparent 70%)", borderRadius: "50%" 
      }} />
      
      <div className="glass-panel animate-fade" style={{ width: 450, padding: 40, textAlign: "center" }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>إنشاء حساب جديد</h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 32 }}>ابدأ بإدارة عيادتك الآن</p>

        {error && (
          <div className="glass-panel" style={{ 
            padding: "16px", marginBottom: "24px", background: "rgba(239, 68, 68, 0.1)", 
            border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "12px"
          }}>
            <p style={{ color: "#ef4444", fontSize: "14px" }}>{error}</p>
          </div>
        )}

        <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ textAlign: "right" }}>
            <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 8 }}>{t("اسم العيادة")}</label>
            <input 
              type="text" 
              className="glass-input" 
              style={{ width: "100%", textAlign: "center" }}
              value={formData.clinic_name}
              onChange={e => setFormData({...formData, clinic_name: e.target.value})}
            />
          </div>

          <div style={{ textAlign: "right" }}>
            <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 8 }}>{t("اسم المستخدم")}</label>
            <input 
              type="text" 
              className="glass-input" 
              style={{ width: "100%", textAlign: "center" }}
              value={formData.username}
              onChange={e => setFormData({...formData, username: e.target.value})}
            />
          </div>

          <div style={{ textAlign: "right" }}>
            <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 8 }}>{t("كلمة المرور")}</label>
            <input 
              type="password" 
              className="glass-input" 
              style={{ width: "100%", textAlign: "center" }}
              value={formData.password}
              onChange={e => setFormData({...formData, password: e.target.value})}
            />
          </div>
          
          <button disabled={loading} className="btn-primary" style={{ height: 48, fontSize: 16, marginTop: 8 }}>
            {loading ? "جاري الإنشاء..." : "إنشاء الحساب"}
          </button>
        </form>

        <div style={{ marginTop: 32, fontSize: 13, color: "var(--text-muted)" }}>
          لديك حساب بالفعل؟ <Link to="/login" style={{ color: "var(--accent)", textDecoration: "none" }}>دخول النظام</Link>
        </div>
      </div>
    </div>
  );
}
