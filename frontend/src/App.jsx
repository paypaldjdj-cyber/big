import React, { useState, useEffect } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { BASE } from "./api";
import { AuthProvider, useAuth }  from "./AuthContext";
import { LanguageProvider, useLanguage } from "./LanguageContext";
import { SettingsProvider }       from "./SettingsContext";
import Layout        from "./components/Layout";
import Login         from "./pages/Login";
import Home          from "./pages/Home";
import Patients      from "./pages/Patients";
import PatientProfile from "./pages/PatientProfile";
import Appointments  from "./pages/Appointments";
import Invoices      from "./pages/Invoices";
import Reports       from "./pages/Reports";
import Settings      from "./pages/Settings";
import Expenses      from "./pages/Expenses";
import Debts         from "./pages/Debts";
import Prescriptions from "./pages/Prescriptions";
import Admin         from "./pages/Admin";
import Register      from "./pages/Register";
import DrugStore     from "./pages/DrugStore";
import TodaySchedule from "./pages/TodaySchedule";
import AuditLog from "./pages/AuditLog";
import Inventory from "./pages/Inventory";
import DailySummary from "./pages/DailySummary";
import Landing from "./pages/Landing";
import Chat from "./components/Chat";
import { lazy, Suspense as ReactSuspense } from "react";

function ProtectedApp() {
  const { user, logout } = useAuth();
  const { lang } = useLanguage();
  
  if (!user) return <Navigate to="/" replace />;
  
  // If an admin somehow lands in the clinic layout, redirect them immediately to their dashboard
  if (user.role === 'admin') return <Navigate to="/admin" replace />;

  // Check subscription/status (Only for non-admin)
  const isInactive = user?.role !== 'admin' && user?.status === 'inactive';
  const isExpired = user?.role !== 'admin' && user?.expiry_date && new Date(user.expiry_date) < new Date();

  
  if (isInactive || isExpired) {
    return (
      <div style={{ 
        height: "100vh", width: "100vw", background: "var(--bg-dark)", 
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        color: "var(--text-light)", padding: "20px", textAlign: "center"
      }}>
        <div className="glass-panel" style={{ padding: "40px", maxWidth: "500px" }}>
          <div style={{ fontSize: "64px", marginBottom: "20px" }}>⚠️</div>
          <h1 style={{ fontSize: "24px", marginBottom: "16px" }}>الحساب معطل أو انتهى الاشتراك</h1>
          <p style={{ color: "var(--text-muted)", marginBottom: "32px", lineHeight: "1.6" }}>
            عذراً، لا يمكنك الوصول إلى النظام حالياً. يرجى الاتصال بالإدارة لتجديد اشتراكك أو تفعيل الحساب عبر الرقم التالي:<br/>
            <strong style={{ color: "var(--accent)", fontSize: "20px" }}>{user.support_phone}</strong>
          </p>
          <button className="btn-secondary" onClick={logout}>تسجيل الخروج</button>
        </div>
      </div>
    );
  }
  
  return (
    <Layout>
      <Routes>
        <Route path="/home"           element={<Home />} />
        <Route path="/patients"       element={<Patients />} />
        <Route path="/patients/:id"   element={<PatientProfile />} />
        <Route path="/appointments"   element={<Appointments />} />
        <Route path="/today-schedule" element={<TodaySchedule />} />
        <Route path="/invoices"       element={<Invoices />} />
        <Route path="/reports"        element={user?.role === 'secretary' ? <Navigate to="/home" /> : <Reports />} />
        <Route path="/expenses"       element={<Expenses />} />
        <Route path="/debts"          element={<Debts />} />
        <Route path="/prescriptions"  element={<Prescriptions />} />
        <Route path="/drugs"          element={user?.role === 'secretary' ? <Navigate to="/home" /> : <DrugStore />} />
        <Route path="/settings"       element={<Settings />} />
        <Route path="/inventory"      element={<Inventory />} />
        <Route path="/daily-summary"  element={user?.role === 'secretary' ? <Navigate to="/home" /> : <DailySummary />} />
        <Route path="/audit-log"      element={user?.role === 'secretary' ? <Navigate to="/home" /> : <AuditLog />} />
        <Route path="/"               element={<Navigate to="/home" replace />} />
        <Route path="*"               element={<Navigate to="/home" />} />
      </Routes>
    </Layout>
  );
}

function AuthRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      {/* Guest Entrance */}
      <Route path="/" element={user ? <Navigate to={user.role === 'admin' ? "/admin" : "/home"} replace /> : <Landing />} />
      
      <Route path="/login" element={user ? <Navigate to={user.role === 'admin' ? "/admin" : "/home"} replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to={user.role === 'admin' ? "/admin" : "/home"} replace /> : <Register />} />
      
      <Route path="/admin" element={
        <ProtectedAdmin>
          <Admin />
        </ProtectedAdmin>
      } />
      
      {/* Protected Clinic App */}
      <Route path="/*" element={<ProtectedApp />} />
    </Routes>
  );
}

export default function App() {
  const [announcement, setAnnouncement] = useState("");
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    // 🎨 Theme Persistence Logic
    const savedLightMode = localStorage.getItem("light-mode") === "true";
    if (savedLightMode) {
      document.body.classList.add("light-mode");
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    
    fetch(`${BASE}/auth/announcement`)
      .then(r => r.json())
      .then(d => { if (d.message) setAnnouncement(d.message); })
      .catch(() => {});

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <LanguageProvider>
      <AuthProvider>
        <SettingsProvider>
          <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
            {!isOnline && (
              <div style={{
                background: 'linear-gradient(90deg, #ff416c, #ff4b2b)',
                color: 'white',
                padding: '8px 20px',
                textAlign: 'center',
                fontSize: '13px',
                fontWeight: '700',
                zIndex: 1000003,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}>
                <span style={{ fontSize: '16px' }}>🔌</span>
                أنت تعمل حالياً في وضع عدم الاتصال. سيتم حفظ التغييرات محلياً ومزامنتها عند عودة الإنترنت.
              </div>
            )}
            {announcement && (

              <div style={{
                background: 'linear-gradient(90deg, #0061ff, #6033ff)',
                color: 'white',
                padding: '10px 20px',
                textAlign: 'center',
                fontSize: '13px',
                fontWeight: '600',
                boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                position: 'relative',
                zIndex: 1000002,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px'
              }}>
                <span style={{ fontSize: '16px' }}>📢</span>
                {announcement}
                <button 
                  onClick={() => setAnnouncement("")}
                  style={{ position: 'absolute', right: '15px', background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', cursor: 'pointer', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}
                >✕</button>
              </div>
            )}
            <HashRouter>
              <AuthRoutes />
              <Chat />
            </HashRouter>
          </div>
        </SettingsProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}

function ProtectedAdmin({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  if (user.role !== 'admin') return <Navigate to="/" />;
  return children;
}
