import React, { useState, useEffect } from "react";
import { getDoctors, createDoctor, deleteDoctor, updateDoctor, getAdminSettings, updateAdminSettings, getAdminStats, getAdminBackups, getAdminBackupUrl } from "../api";

import { useLanguage } from "../LanguageContext";
import { useAuth } from "../AuthContext";

export default function Admin() {
  const { logout } = useAuth();
  const [doctors, setDoctors] = useState([]);
  const [stats, setStats] = useState({ total_clinics: 0, active_clinics: 0, expired_clinics: 0, new_today: 0 });
  const [backups, setBackups] = useState([]);
  const [supportPhone, setSupportPhone] = useState("");
  const [broadcast, setBroadcast] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState({
    username: "", password: "", clinic_name: "", expiry_date: "", status: "active",
    secretary_enabled: 0, secretary_password: "",
    settings: { currency: "IQD", doctor_name: "" }
  });
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("clinics"); 
  const { language, setLanguage } = useLanguage();

  const fetchData = async () => {
    try {
      const docs = await getDoctors();
      setDoctors(docs);
      console.log("FETCH_ADMIN: Doctors loaded", docs.length);
      const s = await getAdminStats();
      setStats(s);
      console.log("FETCH_ADMIN: Stats loaded", s);
      const settings = await getAdminSettings();
      setSupportPhone(settings.support_phone || "");
      setBroadcast(settings.broadcast_message || "");
      const b = await getAdminBackups();
      setBackups(b);
    } catch (e) { 
      console.error("FETCH_ADMIN_ERROR:", e); 
    }
  };

  useEffect(() => {
    fetchData();
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    setFormData(prev => ({ ...prev, expiry_date: nextYear.toISOString().split('T')[0] }));
  }, []);

  const handleUpdateGlobalSettings = async () => {
    try {
      await updateAdminSettings({ support_phone: supportPhone, broadcast_message: broadcast });
      alert("تم تحديث الإعدادات العامة بنجاح!");
    } catch (e) { alert("Error updating settings"); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingId) {
        await updateDoctor(editingId, formData);
        alert("تم التحديث بنجاح!");
      } else {
        await createDoctor(formData);
        alert("تم إنشاء العيادة بنجاح!");
      }
      resetForm();
      fetchData();
    } catch (err) { alert("Error: " + err.message); }
    setLoading(false);
  };

  const resetForm = () => {
    setEditingId(null);
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    setFormData({
      username: "", password: "", clinic_name: "", expiry_date: nextYear.toISOString().split('T')[0],
      status: "active", secretary_enabled: 0, secretary_password: "",
      settings: { currency: "IQD", doctor_name: "" }
    });
  };

  const handleEdit = (doc) => {
    setEditingId(doc.id);
    setFormData({
      username: doc.username, password: "", clinic_name: doc.clinic_name,
      expiry_date: doc.expiry_date || "", status: doc.status || "active",
      secretary_enabled: doc.secretary_enabled || 0, secretary_password: doc.secretary_password || "",
      settings: { currency: "IQD", doctor_name: doc.clinic_name }
    });
    setTab("clinics");
    window.scrollTo({ top: 400, behavior: 'smooth' });
  };

  const filteredDoctors = doctors.filter(d => 
    d.clinic_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    d.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="admin-page dark-theme" dir={language === "ar" ? "rtl" : "ltr"}>
      {/* Header Area */}
      <header className="admin-header glass">
        <div className="header-info">
          <h1>لوحة تحكم النظام السحابي</h1>
          <p>إدارة عيادات SmileCare SaaS المركزية</p>
        </div>
        <div className="header-actions" style={{ display: "flex", gap: 12 }}>
           <button className="lang-toggle" onClick={() => setLanguage(language === "ar" ? "en" : "ar")}>
            {language === "ar" ? "English" : "العربية"}
          </button>
          <button className="btn-cancel" style={{ padding: "12px 24px" }} onClick={logout}>
            🚪 تسجيل الخروج
          </button>
        </div>
      </header>

      {/* Horizontal Stats Area */}
      <div className="stats-grid">
        <div className="stat-card blue">
          <div className="stat-icon">🏥</div>
          <div className="stat-data">
            <h3>{stats.total_clinics}</h3>
            <span>إجمالي العيادات</span>
          </div>
        </div>
        <div className="stat-card green">
          <div className="stat-icon">✅</div>
          <div className="stat-data">
            <h3>{stats.active_clinics}</h3>
            <span>عيادات نشطة</span>
          </div>
        </div>
        <div className="stat-card orange">
          <div className="stat-icon">⚠️</div>
          <div className="stat-data">
            <h3>{stats.expired_clinics}</h3>
            <span>اشتراكات منتهية</span>
          </div>
        </div>
        <div className="stat-card purple">
          <div className="stat-icon">✨</div>
          <div className="stat-data">
            <h3>{stats.new_today}</h3>
            <span>مشتركين اليوم</span>
          </div>
        </div>
      </div>

      {/* Horizontal Navigation Area */}
      <nav className="horizontal-nav glass">
        <button className={tab === 'clinics' ? 'active' : ''} onClick={() => setTab('clinics')}>🏢 إدارة العيادات والاشتراكات</button>
        <button className={tab === 'backups' ? 'active' : ''} onClick={() => setTab('backups')}>☁️ مراقبة النسخ الاحتياطية</button>
        <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>⚙️ إعدادات النظام والبث العام</button>
      </nav>

      {/* Main Content Area (Full Width) */}
      <div className="admin-main-full">
        {tab === 'clinics' && (
          <div className="tab-pane animate-in">
            <div className="pane-header glass">
              <h2>مركز التحكم في العيادات</h2>
              <div className="search-bar">
                <input placeholder="ابحث عن عيادة..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
            </div>

            <div className="doctor-form-panel glass">
              <h3>{editingId ? "تعديل حساب العيادة" : "إضافة حساب عيادة جديد"}</h3>
              <form onSubmit={handleSubmit} className="doctor-form">
                <div className="form-group">
                  <label>اسم العيادة</label>
                  <input value={formData.clinic_name} onChange={e => setFormData({...formData, clinic_name: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>اسم المستخدم</label>
                  <input disabled={!!editingId} value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>{editingId ? "تغيير كلمة المرور" : "كلمة المرور"}</label>
                  <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>تاريخ انتهاء الاشتراك</label>
                  <input type="date" value={formData.expiry_date} onChange={e => setFormData({...formData, expiry_date: e.target.value})} />
                </div>
                <div className="form-actions">
                  <button type="submit" className="btn-save" disabled={loading}>{loading ? "جاري المعالجة..." : (editingId ? "تحديث الحساب" : "إنشاء العيادة")}</button>
                  {editingId && <button type="button" className="btn-cancel" onClick={resetForm}>إلغاء</button>}
                </div>
              </form>
            </div>

            <div className="clinics-table-container glass">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>اسم العيادة</th>
                    <th>المستخدم</th>
                    <th>انتهاء الاشتراك</th>
                    <th>الحالة</th>
                    <th>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDoctors.map(doc => (
                    <tr key={doc.id}>
                      <td className="bold">{doc.clinic_name}</td>
                      <td><span className="username-badge">{doc.username}</span></td>
                      <td style={{ color: new Date(doc.expiry_date) < new Date() ? "#ff4d4d" : "inherit" }}>{doc.expiry_date}</td>
                      <td>
                         <span className={`status-pill ${doc.status}`}>{doc.status === 'active' ? 'نشط' : 'معطل'}</span>
                      </td>
                      <td>
                        <button className="action-btn edit" onClick={() => handleEdit(doc)}>✏️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'settings' && (
          <div className="settings-pane-horizontal animate-in">
            <div className="settings-row">
              <div className="broadcast-box glass">
                <h4>📢 الرسالة الجماعية (Broadcast)</h4>
                <p className="hint-text">هذه الرسالة تظهر في أعلى شاشة كافة الأطباء والسكرتارية</p>
                <textarea 
                  placeholder="اكتب رسالة التنبيه أو الترحيب هنا..."
                  value={broadcast}
                  onChange={(e) => setBroadcast(e.target.value)}
                />
                <button className="btn-save" onClick={handleUpdateGlobalSettings}>بث الرسالة فوراً</button>
              </div>

              <div className="support-box glass">
                <h4>📞 رقم الدعم الفني المركزي</h4>
                <p className="hint-text">يظهر للعيادات المعطلة أو المنتهية صلاحيتها</p>
                <input value={supportPhone} onChange={(e) => setSupportPhone(e.target.value)} />
                <button className="btn-save" onClick={handleUpdateGlobalSettings}>حفظ رقم الدعم</button>
              </div>
            </div>
          </div>
        )}

        {tab === 'backups' && (
          <div className="tab-pane animate-in">
            <div className="pane-header glass">
              <h2>☁️ السحابة المركزية لقواعد البيانات</h2>
              <div className="search-bar" style={{ opacity: 0.5 }}>
                <span style={{ color: "white", fontSize: 13 }}>تحديث تلقائي لحجم الملفات</span>
              </div>
            </div>

            <div className="clinics-table-container glass">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>اسم العيادة</th>
                    <th>حجم القاعدة (MB)</th>
                    <th>آخر تعديل (تاريخ)</th>
                    <th>حالة الملف</th>
                    <th>تحميل للكمبيوتر</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.map((b, idx) => (
                    <tr key={idx}>
                      <td className="bold">{b.clinic_name} <br/><span style={{fontSize:11, color:'var(--text-muted)', fontWeight:'normal'}}>{b.username}</span></td>
                      <td>
                        <span style={{ color: b.size_mb > 50 ? "#f59e0b" : "#10b981", fontWeight: 700, fontSize: 18 }}>
                          {b.size_mb} <span style={{fontSize: 12}}>MB</span>
                        </span>
                      </td>
                      <td style={{ direction: "ltr", textAlign: "right" }}>{b.last_modified}</td>
                      <td>
                        <span className={`status-pill ${b.status === 'Available' ? 'active' : 'inactive'}`}>
                          {b.status === 'Available' ? 'موجود' : 'مفقود!'}
                        </span>
                      </td>
                      <td>
                        <button 
                          disabled={b.status !== 'Available'}
                          className="btn-save" 
                          style={{ padding: "10px 20px", fontSize: 13, background: b.status !== 'Available' ? "#333" : "#10b981" }}
                          onClick={() => window.open(getAdminBackupUrl(b.username), '_blank')}
                        >
                          ⬇️ تحميل
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {backups.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>جاري استرداد بيانات السحابة...</div>}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .admin-page.dark-theme { 
          padding: 40px; 
          background: #0f172a; 
          min-height: 100vh; 
          color: #f1f5f9; 
          font-family: inherit;
          background-image: radial-gradient(circle at 0% 0%, rgba(30, 64, 175, 0.1) 0%, transparent 50%),
                            radial-gradient(circle at 100% 100%, rgba(124, 58, 237, 0.1) 0%, transparent 50%);
        }
        
        .glass { 
          background: rgba(30, 41, 59, 0.7); 
          backdrop-filter: blur(12px); 
          border: 1px solid rgba(255, 255, 255, 0.05); 
          border-radius: 24px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        
        .admin-header { display: flex; justify-content: space-between; align-items: center; padding: 30px 45px; margin-bottom: 35px; }
        .admin-header h1 { margin: 0; font-size: 28px; color: #38bdf8; font-weight: 800; letter-spacing: -0.5px; }
        .admin-header p { margin: 8px 0 0; color: #94a3b8; font-size: 15px; }
        
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 25px; margin-bottom: 35px; }
        .stat-card { background: rgba(30, 41, 59, 0.5); padding: 25px; borderRadius: 24px; display: flex; align-items: center; gap: 20px; border: 1px solid rgba(255, 255, 255, 0.03); }
        .stat-icon { font-size: 32px; width: 60px; height: 60px; background: rgba(255, 255, 255, 0.05); borderRadius: 18px; display: flex; align-items: center; justifyContent: center; }
        .stat-data h3 { margin: 0; font-size: 30px; font-weight: 800; color: #fff; }
        .stat-data span { font-size: 14px; color: #64748b; }
        
        .horizontal-nav { display: flex; gap: 15px; padding: 12px; margin-bottom: 35px; }
        .horizontal-nav button { flex: 1; background: none; border: none; padding: 18px; borderRadius: 16px; cursor: pointer; transition: 0.4s; font-size: 16px; font-weight: 600; color: #94a3b8; display: flex; align-items: center; justifyContent: center; gap: 12px; }
        .horizontal-nav button.active { background: #0284c7; color: white; boxShadow: 0 12px 20px rgba(2, 132, 199, 0.3); }
        .horizontal-nav button:hover:not(.active) { background: rgba(255,255,255,0.05); color: #38bdf8; }
        
        .admin-main-full { display: flex; flexDirection: column; gap: 35px; }
        
        .pane-header { display: flex; justify-content: space-between; align-items: center; padding: 25px 35px; margin-bottom: 30px; }
        .pane-header h2 { margin: 0; font-size: 20px; color: #e2e8f0; font-weight: 700; }
        .search-bar input { padding: 14px 28px; borderRadius: 40px; border: 1px solid rgba(255,255,255,0.1); width: 380px; outline: none; background: rgba(15, 23, 42, 0.5); color: white; transition: 0.3s; }
        .search-bar input:focus { border-color: #0284c7; background: rgba(15, 23, 42, 0.8); boxShadow: 0 0 0 4px rgba(2, 132, 199, 0.2); }
        
        .doctor-form-panel { padding: 35px; margin-bottom: 30px; }
        .doctor-form-panel h3 { margin: 0 0 25px; font-size: 18px; color: #38bdf8; font-weight: 700; }
        .doctor-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 25px; }
        .form-group label { display: block; font-size: 13px; color: #94a3b8; margin-bottom: 10px; font-weight: 600; }
        .form-group input { width: 100%; padding: 14px; borderRadius: 14px; border: 1px solid rgba(255,255,255,0.1); outline: none; background: rgba(15, 23, 42, 0.4); color: white; transition: 0.3s; }
        .form-group input:focus { border-color: #0284c7; background: rgba(15, 23, 42, 0.6); }
        
        .settings-pane-horizontal .settings-row { display: grid; grid-template-columns: 1fr 1fr; gap: 35px; }
        .broadcast-box h4, .support-box h4 { margin: 0 0 8px; font-size: 18px; font-weight: 700; color: #fff; }
        .hint-text { font-size: 12px; color: #64748b; margin-bottom: 20px; }
        .broadcast-box textarea { width: 100%; height: 140px; padding: 18px; borderRadius: 18px; border: 1px solid rgba(255,255,255,0.1); resize: none; font-size: 15px; margin-bottom: 20px; background: rgba(15, 23, 42, 0.4); color: white; }
        .support-box input { width: 100%; padding: 18px; borderRadius: 18px; border: 1px solid rgba(255,255,255,0.1); margin-bottom: 20px; font-size: 18px; background: rgba(15, 23, 42, 0.4); color: white; text-align: center; font-weight: 700; }
        
        .admin-table { width: 100%; border-collapse: collapse; }
        .admin-table th { textAlign: right; padding: 22px 30px; border-bottom: 1px solid rgba(255,255,255,0.05); color: #64748b; font-weight: 700; font-size: 14px; background: rgba(0,0,0,0.1); }
        .admin-table td { padding: 22px 30px; border-bottom: 1px solid rgba(255,255,255,0.03); font-size: 15px; }
        .admin-table tr:hover { background: rgba(255,255,255,0.02); }
        .bold { font-weight: 700; color: #fff; }
        .username-badge { background: rgba(56, 189, 248, 0.1); color: #38bdf8; padding: 4px 10px; borderRadius: 8px; font-size: 13px; font-family: monospace; }
        .status-pill { padding: 8px 18px; borderRadius: 25px; font-size: 13px; font-weight: 700; }
        .status-pill.active { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .status-pill.inactive { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
        .action-btn { background: rgba(255,255,255,0.05); border: none; cursor: pointer; width: 44px; height: 44px; borderRadius: 14px; transition: 0.3s; color: #fff; display: flex; alignItems: center; justifyContent: center; }
        .action-btn:hover { background: rgba(2, 132, 199, 0.2); transform: scale(1.1); color: #38bdf8; }
        
        .btn-save { padding: 16px 35px; background: #0284c7; color: white; border: none; borderRadius: 16px; cursor: pointer; font-weight: 700; transition: 0.3s; width: 100%; }
        .btn-save:hover { background: #0369a1; boxShadow: 0 10px 20px rgba(2, 132, 199, 0.4); transform: translateY(-2px); }
        .btn-cancel { padding: 16px 35px; background: rgba(255,255,255,0.05); color: #94a3b8; border: none; borderRadius: 16px; cursor: pointer; }
        
        .lang-toggle { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 12px 24px; borderRadius: 14px; cursor: pointer; font-weight: 700; color: #e2e8f0; transition: 0.3s; }
        .lang-toggle:hover { background: #0284c7; color: white; }
        
        .animate-in { animation: fadeIn 0.5s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
