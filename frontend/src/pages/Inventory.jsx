import React, { useState, useEffect } from "react";
import { useLanguage } from "../LanguageContext";
import { useAuth } from "../AuthContext";
import { getInventory, addInventoryItem, updateInventoryItem, updateInventoryStock, deleteInventoryItem } from "../api";
import ConfirmModal from "../components/ConfirmModal";

export default function Inventory() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const isSecretary = user?.role === 'secretary';
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [confirmData, setConfirmData] = useState({ show: false, message: "", onConfirm: null });
  
  const [newItem, setNewItem] = useState({
    name: "", category: "General", stock: 0, min_stock: 5, unit: "Piece", price: 0
  });

  const categories = [
    "Composite & Filling", "Bonding & Etching", "Impression Materials", 
    "Endodontic Supplies", "Disposable (Gloves/Masks)", "Sterilization", "Instruments", "Orthodontics", "General"
  ];

  const load = async () => {
    setLoading(true);
    try {
      const data = await getInventory();
      setItems(data);
    } catch(e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if(!newItem.name) return;
    
    try {
      if (editingId) {
        await updateInventoryItem(editingId, newItem);
      } else {
        await addInventoryItem(newItem);
      }
      setNewItem({ name: "", category: "General", stock: 0, min_stock: 5, unit: "Piece", price: 0 });
      setEditingId(null);
      setShowAddForm(false);
      load();
    } catch(e) { alert(e.message); }
  };

  const handleStockChange = async (id, change) => {
    try {
      await updateInventoryStock(id, change);
      load();
    } catch(e) { console.error(e); }
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setNewItem(item);
    setShowAddForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = (id) => {
    setConfirmData({
      show: true,
      message: t("هل أنت متأكد من حذف هذه المادة؟"),
      onConfirm: async () => {
        setConfirmData({ show: false });
        await deleteInventoryItem(id);
        load();
      }
    });
  };

  return (
    <div className="animate-fade">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>📦 {t("مخزن مواد العيادة")}</h2>
        {!isSecretary && (
          <button className="btn-primary" onClick={() => { setShowAddForm(!showAddForm); setEditingId(null); setNewItem({ name: "", category: "General", stock: 0, min_stock: 5, unit: "Piece", price: 0 }); }}>
             {showAddForm ? t("إغلاق") : `+ ${t("إضافة مادة جديدة")}`}
          </button>
        )}
      </div>

      {showAddForm && (
        <div className="glass-panel animate-fade" style={{ padding: 24, marginBottom: 32 }}>
          <h3 style={{ fontSize: 18, marginBottom: 20 }}>{editingId ? t("تعديل مادة") : t("إضافة مادة جديدة")}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
             <div>
                <label style={lblStyle}>{t("اسم المادة")}</label>
                <input className="glass-input" style={{ width: "100%" }} value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} placeholder="Composite A2..." />
             </div>
             <div>
                <label style={lblStyle}>{t("التصنيف")}</label>
                <select className="glass-input" style={{ width: "100%", padding: 10 }} value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})}>
                   {categories.map(c => <option key={c} value={c}>{t(c)}</option>)}
                </select>
             </div>
             <div>
                <label style={lblStyle}>{t("سعر الشراء (للوحدة)")}</label>
                <input type="number" className="glass-input" style={{ width: "100%" }} value={newItem.price} onChange={e => setNewItem({...newItem, price: parseFloat(e.target.value)})} />
             </div>
             <div>
                <label style={lblStyle}>{t("الكمية الحالية")}</label>
                <input type="number" className="glass-input" style={{ width: "100%" }} value={newItem.stock} onChange={e => setNewItem({...newItem, stock: parseFloat(e.target.value)})} />
             </div>
             <div>
                <label style={lblStyle}>{t("تنبيه عند نقص الكمية")}</label>
                <input type="number" className="glass-input" style={{ width: "100%" }} value={newItem.min_stock} onChange={e => setNewItem({...newItem, min_stock: parseFloat(e.target.value)})} />
             </div>
             <div>
                <label style={lblStyle}>{t("الوحدة")}</label>
                <input className="glass-input" style={{ width: "100%" }} value={newItem.unit} onChange={e => setNewItem({...newItem, unit: e.target.value})} placeholder="Tube, Box, Piece..." />
             </div>
          </div>
          <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
             <button className="btn-primary" onClick={handleSave} style={{ padding: "10px 32px" }}>{t("حفظ")}</button>
             <button className="btn-ghost" onClick={() => setShowAddForm(false)}>{t("إلغاء")}</button>
          </div>
        </div>
      )}

      {/* Grid view for inventory items */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
        {items.map(item => (
          <div key={item.id} className="glass-panel" style={{ 
            padding: 24, 
            border: item.stock <= item.min_stock ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid rgba(255,255,255,0.05)",
            background: item.stock <= item.min_stock ? "rgba(239, 68, 68, 0.03)" : "rgba(255,255,255,0.02)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
               <div>
                  <div style={{ fontSize: 11, color: "var(--primary)", fontWeight: 700, marginBottom: 4, textTransform: "uppercase" }}>{t(item.category)}</div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{item.name}</div>
               </div>
               {!isSecretary && (
                 <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => handleEdit(item)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14 }}>✏️</button>
                    <button onClick={() => handleDelete(item.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14 }}>🗑️</button>
                 </div>
               )}
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.02)", padding: 16, borderRadius: 16 }}>
               <div style={{ textAlign: "center", flex: 1 }}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>{t("الرصيد الحالي")}</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: item.stock <= item.min_stock ? "var(--danger)" : "var(--primary)" }}>
                     {item.stock} <span style={{ fontSize: 12, fontWeight: 400 }}>{item.unit}</span>
                  </div>
                  <div style={{ fontSize: 11, marginTop: 4, color: "var(--text-muted)" }}>{t("السعر:")} {item.price} {t("د")}</div>
               </div>

               <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => handleStockChange(item.id, -1)} className="btn-ghost" style={{ width: 40, height: 40, borderRadius: 12, padding: 0, fontSize: 20 }}>-</button>
                  {!isSecretary && <button onClick={() => handleStockChange(item.id, 1)} className="btn-ghost" style={{ width: 40, height: 40, borderRadius: 12, padding: 0, fontSize: 20 }}>+</button>}
               </div>
            </div>

            {item.stock <= item.min_stock && (
              <div style={{ marginTop: 16, background: "rgba(239, 68, 68, 0.1)", color: "#ef4444", padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, textAlign: "center" }}>
                ⚠️ {t("تحذير: المخزون أوشك على النفاذ!")}
              </div>
            )}
            
            <div style={{ marginTop: 16, fontSize: 10, color: "var(--text-muted)", textAlign: "center" }}>
               {t("آخر تحديث:")} {new Date(item.last_updated).toLocaleString(t("ar-SA"))}
            </div>
          </div>
        ))}
        {items.length === 0 && !loading && (
          <div style={{ gridColumn: "1/-1", padding: 60, textAlign: "center", opacity: 0.5 }}>
             <div style={{ fontSize: 40, marginBottom: 16 }}>📦</div>
             {t("المخزن فارغ حالياً. ابدأ بإضافة موادك الطبية.")}
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
