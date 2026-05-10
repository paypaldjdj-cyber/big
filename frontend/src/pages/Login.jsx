import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { useLanguage } from "../LanguageContext";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { t } = useLanguage();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username || !password) return;
    setLoading(true);
    setError(null);
    try {
      await login(username.trim(), password);
    } catch (err) {
      window.lastErrorPhone = err.support_phone;
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ 
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg-dark)", position: "relative", overflow: "hidden" 
    }}>
      {/* Animated Background Orbs */}
      <div style={{ 
        position: "absolute", top: "-10%", left: "-10%", width: "40vw", height: "40vw", 
        background: "radial-gradient(circle, rgba(24, 95, 165, 0.15) 0%, transparent 70%)", borderRadius: "50%" 
      }} />
      <div style={{ 
        position: "absolute", bottom: "-10%", right: "-10%", width: "40vw", height: "40vw", 
        background: "radial-gradient(circle, rgba(0, 210, 255, 0.1) 0%, transparent 70%)", borderRadius: "50%" 
      }} />

      <div className="glass-panel animate-fade" style={{ width: 400, padding: 40, textAlign: "center" }}>
        <div style={{ 
          width: 64, height: 64, borderRadius: 20, background: "linear-gradient(135deg, #185FA5, #00D2FF)",
          margin: "0 auto 24px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32
        }}>🦷</div>
        
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>SmileCare</h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 32 }}>{t("نظام إدارة العيادات الذكي")}</p>

        {error && (
          <div className="glass-panel" style={{ 
            padding: "16px", marginBottom: "24px", background: "rgba(239, 68, 68, 0.1)", 
            border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "12px", textAlign: "right"
          }}>
            <p style={{ color: "#ef4444", fontSize: "14px", fontWeight: "600", marginBottom: "4px" }}>
              {error === "Account deactivated" ? "هذا الحساب معطل حالياً" : 
               error === "Subscription expired" ? "انتهت مدة الاشتراك" : 
               (error.includes("أوفلاين") ? "دخول في وضع الأوفلاين" : "خطأ في الدخول")}
            </p>
            <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              {error.includes("أوفلاين") ? error : 
               (error.toLowerCase().includes("invalid") || error.toLowerCase().includes("unauthorized") || error.toLowerCase().includes("credentials")) 
                ? "اسم المستخدم أو كلمة المرور غير صحيحة" 
                : "يرجى مراجعة الإدارة للتفعيل."}
            </p>
            {window.lastErrorPhone && (
              <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.05)", fontSize: "13px" }}>
                رقم الدعم: <strong style={{ color: "var(--accent)" }}>{window.lastErrorPhone}</strong>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ textAlign: "right" }}>
            <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 8, paddingRight: 4 }}>
              {t("اسم المستخدم")}
            </label>
            <input 
              type="text" 
              className="glass-input" 
              placeholder="username"
              style={{ width: "100%", textAlign: "center", fontSize: 16 }}
              value={username}
              onChange={e => setUsername(e.target.value)}
            />
          </div>

          <div style={{ textAlign: "right" }}>
            <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 8, paddingRight: 4 }}>
              {t("كلمة المرور")}
            </label>
            <input 
              type="password" 
              className="glass-input" 
              placeholder="••••••••"
              style={{ width: "100%", textAlign: "center", letterSpacing: 4, fontSize: 20 }}
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          
          <button disabled={loading} className="btn-primary" style={{ height: 48, fontSize: 16, marginTop: 8 }}>
            {loading ? t("جاري الدخول...") : t("دخول النظام")}
          </button>
        </form>

        <div style={{ marginTop: 32, fontSize: 13, color: "var(--text-muted)" }}>
          {t("ليس لديك حساب؟")} <Link to="/register" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>{t("إنشاء حساب جديد")}</Link>
        </div>
      </div>

      <div style={{ position: "absolute", bottom: 24, fontSize: 11, color: "rgba(255,255,255,0.2)" }}>
        SmileCare SaaS Edition v1.0 · Premium Iraqi Edition
      </div>
    </div>
  );
}
