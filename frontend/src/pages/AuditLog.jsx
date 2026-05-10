import { useEffect, useState } from "react";
import { useAuth } from "../AuthContext";
import { useLanguage } from "../LanguageContext";
import { getAuditLogs } from "../api";
import { useNavigate } from "react-router-dom";

export default function AuditLog() {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState("");

  useEffect(() => {
    if (user?.role !== "doctor") {
      navigate("/");
      return;
    }
    load();
  }, [roleFilter]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getAuditLogs(roleFilter);
      setLogs(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const getActionColor = (action) => {
    if (action.includes("DELETE")) return "#ef4444"; // Red
    if (action.includes("CREATE") || action.includes("ADD")) return "#22c55e"; // Green
    if (action.includes("UPDATE")) return "#3b82f6"; // Blue
    if (action.includes("LOGIN")) return "#f59e0b"; // Orange
    return "var(--text-light)";
  };

  const formatAction = (action) => {
    const map = {
      "LOGIN": "تسجيل دخول",
      "LOGOUT": "تسجيل خروج",
      "CREATE_PATIENT": "إضافة مريض",
      "UPDATE_PATIENT": "تعديل مريض",
      "DELETE_PATIENT": "حذف مريض",
      "VIEW_PATIENT": "فتح ملف",
      "ADD_INVOICE": "إضافة فاتورة",
      "PAY_INVOICE": "تسديد مبلغ",
      "DELETE_INVOICE": "حذف فاتورة",
      "UPDATE_TEETH": "تعديل خريطة الأسنان",
      "ADD_TREATMENT": "إضافة إجراء علاجي"
    };
    return map[action] || action;
  };

  const [selectedLog, setSelectedLog] = useState(null);

  const renderDiff = (log) => {
    if (!log.old_data && !log.new_data) return <p style={{ color: "var(--text-muted)", fontSize: 13 }}>لا توجد تفاصيل إضافية لهذه الحركة.</p>;
    
    let oldObj = {};
    let newObj = {};
    try {
      oldObj = log.old_data ? JSON.parse(log.old_data) : {};
      newObj = log.new_data ? JSON.parse(log.new_data) : {};
    } catch(e) { return <p>Error parsing data</p>; }

    const allKeys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]));
    const changes = allKeys.filter(k => {
        // Skip internal/uninteresting keys
        if (['id', 'created_at', 'last_visit', 'case_images', 'case_notes', 'map_data'].includes(k)) return false;
        return String(oldObj[k]) !== String(newObj[k]);
    });

    if (changes.length === 0) return <p style={{ color: "var(--text-muted)", fontSize: 13 }}>تمت العملية بنجاح دون تغيير في الحقول الأساسية.</p>;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {changes.map(k => (
          <div key={k} style={{ padding: "12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ fontWeight: 700, color: "var(--primary)", fontSize: 12, marginBottom: 8 }}>{k.toUpperCase()}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13 }}>
              <div style={{ flex: 1, padding: 8, background: "rgba(239, 68, 68, 0.1)", color: "#f87171", borderRadius: 4, textDecoration: "line-through" }}>
                {oldObj[k] || "—"}
              </div>
              <div style={{ color: "var(--text-muted)" }}>←</div>
              <div style={{ flex: 1, padding: 8, background: "rgba(34, 197, 94, 0.1)", color: "#4ade80", borderRadius: 4, fontWeight: 600 }}>
                {newObj[k] || "—"}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (user?.role !== "doctor") return null;

  return (
    <div className="animate-fade" style={{ direction: "rtl", textAlign: "right", position: "relative" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div>
          <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, color: "var(--primary)" }}>🔎 سجل الحركات والمراقبة</h2>
          <p style={{ color: "var(--text-muted)" }}>متابعة كل ما يتم في النظام لحظة بلحظة</p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <select 
            className="glass-input" 
            value={roleFilter} 
            onChange={(e) => setRoleFilter(e.target.value)}
            style={{ padding: "8px 16px", borderRadius: 12 }}
          >
            <option value="">كل المستخدمين</option>
            <option value="doctor">الطبيب فقط</option>
            <option value="secretary">السكرتارية فقط</option>
          </select>
          <button onClick={load} className="btn-secondary" style={{ padding: "8px 20px" }}>🔄 تحديث</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: selectedLog ? "1fr 400px" : "1fr", gap: 24, transition: "all 0.3s" }}>
        <div className="glass-panel" style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                <th style={{ padding: "16px 24px", textAlign: "right", fontSize: 13, color: "var(--text-muted)" }}>الوقت</th>
                <th style={{ padding: "16px 24px", textAlign: "right", fontSize: 13, color: "var(--text-muted)" }}>المستخدم</th>
                <th style={{ padding: "16px 24px", textAlign: "right", fontSize: 13, color: "var(--text-muted)" }}>العملية</th>
                <th style={{ padding: "16px 24px", textAlign: "right", fontSize: 13, color: "var(--text-muted)" }}>الهدف</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="4" style={{ padding: 40, textAlign: "center" }}>جاري تحميل السجلات...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan="4" style={{ padding: 40, textAlign: "center" }}>لا توجد حركات مسجلة بعد.</td></tr>
              ) : logs.map((log) => (
                <tr 
                  key={log.id} 
                  onClick={() => setSelectedLog(log)}
                  style={{ 
                    borderBottom: "1px solid rgba(255,255,255,0.03)", 
                    transition: "background 0.2s",
                    cursor: "pointer",
                    background: selectedLog?.id === log.id ? "rgba(59, 130, 246, 0.1)" : "transparent"
                  }} 
                  onMouseEnter={e => { if(selectedLog?.id !== log.id) e.currentTarget.style.background = "rgba(255,255,255,0.02)"}} 
                  onMouseLeave={e => { if(selectedLog?.id !== log.id) e.currentTarget.style.background = "transparent"}}
                >
                  <td style={{ padding: "16px 24px", fontSize: 14 }}>
                    <div style={{ color: "var(--text-light)" }}>{new Date(log.timestamp + " UTC").toLocaleTimeString("ar-IQ", { hour: '2-digit', minute: '2-digit' })}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{new Date(log.timestamp + " UTC").toLocaleDateString("ar-IQ")}</div>
                  </td>
                  <td style={{ padding: "16px 24px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 18 }}>{log.role === 'doctor' ? '👨‍⚕️' : '👩‍💻'}</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{log.username}</div>
                        <div style={{ fontSize: 11, color: log.role === 'doctor' ? 'var(--primary)' : '#f59e0b', fontWeight: 700 }}>
                          {log.role === 'doctor' ? 'الطبيب' : 'السكرتارية'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "16px 24px" }}>
                    <span style={{ 
                      fontSize: 12, padding: "4px 12px", borderRadius: 20, fontWeight: 700,
                      background: `${getActionColor(log.action)}20`, color: getActionColor(log.action),
                      border: `1px solid ${getActionColor(log.action)}30`
                    }}>
                      {formatAction(log.action)}
                    </span>
                  </td>
                  <td style={{ padding: "16px 24px", fontSize: 14, fontWeight: 600 }}>
                    {log.target_name || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selectedLog && (
          <div className="glass-panel animate-slide-left" style={{ padding: 24, position: "sticky", top: 24, height: "fit-content", maxHeight: "calc(100vh - 48px)", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>🔍 تفاصيل التغيير</h3>
              <button onClick={() => setSelectedLog(null)} className="btn-ghost" style={{ padding: 4 }}>✕</button>
            </div>
            
            <div style={{ marginBottom: 24, padding: "16px", background: "rgba(255,255,255,0.02)", borderRadius: 12 }}>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>الوصف الكامل:</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{selectedLog.description}</div>
            </div>

            {renderDiff(selectedLog)}
          </div>
        )}
      </div>
    </div>
  );
}
