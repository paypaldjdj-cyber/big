import React, { Suspense, useState, Component } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, Center, Environment } from "@react-three/drei";
import * as THREE from "three";
import { useLanguage } from "../LanguageContext";

const getFDINumber = (name) => {
  // Extract number directly (e.g. 11 from "Tooth_11" or "11_Mesh")
  const match = name.match(/\d+/);
  return match ? match[0] : null;
};

const normalizeToothId = (id) => {
  if (!id) return null;
  const s = String(id).trim();
  if (s.toLowerCase() === "general") return "General";
  const n = parseInt(s.match(/\d+/) || s);
  return isNaN(n) ? s : String(n);
};

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return <div style={{ color: "#ef4444", padding: 40, textAlign: "center" }}>⚠️ خطأ في تحميل الموديل ثلاثي الأبعاد</div>;
    return this.props.children;
  }
}

function Model({ url, onToothSelect, toothStatus, treatments, noControls, focusedTooth, updateKey }) {
  const { scene } = useGLTF(url);

  React.useEffect(() => {
    scene.traverse((child) => {
      if (child.isMesh) {
        const rawId = getFDINumber(child.name);
        const toothId = normalizeToothId(rawId);
        if (!toothId) return;

        // Clone material for independence
        if (!child.userData.cloned) {
          child.material = Array.isArray(child.material) ? child.material.map(m => m.clone()) : child.material.clone();
          child.userData.cloned = true;
        }

        const isSessionTooth = treatments?.some(t => normalizeToothId(t.tooth_number || t.tooth) === toothId);
        const isFocused = normalizeToothId(focusedTooth) === toothId;

        let targetColor = null;
        const colors = { 
          "نخر": 0xef4444, "حشو": 0x10b981, "عصب": 0xf59e0b, 
          "خلع": 0x64748b, "تلبيس": 0x3b82f6, "زرعة": 0xa855f7 
        };

        // 1. Determine Base Color based on status
        if (toothStatus[toothId]) {
          targetColor = colors[toothStatus[toothId].status] || 0xd9d9d1;
        }

        // 2. Special overrides (Focus)
        if (isFocused && !noControls) {
          if (!targetColor) targetColor = 0x3b82f6; // Blue highlight for focus if no status
        }

        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach(mat => {
          if (targetColor !== null) {
            mat.color.setHex(targetColor);
          } else {
            mat.color.setRGB(0.85, 0.85, 0.82);
          }

          // Glow for 'Actually Worked On' teeth in this session
          if (isSessionTooth) {
            mat.emissive.setHex(0x10b981);
            mat.emissiveIntensity = 0.6;
            // If it's a session tooth but has no status color, give it a soft green base
            if (targetColor === null) mat.color.setHex(0x10b981);
          } else if (isFocused && !noControls) {
            mat.emissive.setHex(0x3b82f6);
            mat.emissiveIntensity = 0.4;
          } else {
            mat.emissive.setHex(0x000000);
            mat.emissiveIntensity = 0;
          }

          mat.needsUpdate = true;
        });
      }
    });
  }, [scene, toothStatus, treatments, noControls, focusedTooth, updateKey]);

  return (
    <primitive 
      object={scene} 
      scale={1}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
      onPointerOut={(e) => { e.stopPropagation(); document.body.style.cursor = "default"; }}
      onClick={(e) => { 
        e.stopPropagation(); 
        const rawId = getFDINumber(e.object.name);
        if(rawId && onToothSelect) onToothSelect(String(parseInt(rawId)), e.object.name); 
      }}
    />
  );
}

export default function TeethMap3D({ data: externalData, onChange, treatments, noControls = false, pid, focusedTooth, onToothClick }) {
  const { t } = useLanguage();
  const [selectedTooth, setSelectedTooth] = useState(focusedTooth || null);
  const [selectedToothRaw, setSelectedToothRaw] = useState(null);
  const [localData, setLocalData] = useState(externalData || {});
  const [selectedStatus, setSelectedStatus] = useState("نخر");
  const [autoRotate, setAutoRotate] = useState(false);

  // Sync selection if focusedTooth changes externally
  React.useEffect(() => {
    if (focusedTooth) {
      const normId = normalizeToothId(focusedTooth);
      setSelectedTooth(normId);
      // Smart Detection: Pre-select the current status of the tooth
      if (localData[normId]) {
        setSelectedStatus(localData[normId].status || "نخر");
      }
      setUpdateKey(prev => prev + 1); // Force 3D refresh
    }
  }, [focusedTooth, localData]);

  // Keep local data in sync with external updates
  React.useEffect(() => {
    if (externalData) setLocalData(externalData);
  }, [externalData]);

  const statusColors = {
    "نخر": "#ef4444", "حشو": "#10b981", "عصب": "#f59e0b", 
    "خلع": "#64748b", "تلبيس": "#3b82f6", "زرعة": "#a855f7", "سليم": "transparent"
  };

  const [updateKey, setUpdateKey] = useState(0);

  // Filter history for the selected tooth
  const toothTreatments = (treatments || []).filter(t => normalizeToothId(t.tooth_number) === selectedTooth);

  const applyStatus = () => {
    if (!selectedTooth) return;
    const newData = {
      ...localData,
      [selectedTooth]: { status: selectedStatus, surfaces: {} }
    };
    
    // 1. Update local state immediately for instant visual feedback
    setLocalData(newData);
    
    // 2. Notify parent for persistence
    if (onChange) onChange(newData);
    
    // 3. Trigger 3D re-color
    setUpdateKey(prev => prev + 1);
  };

  // Smart Camera Positioning
  let cameraPos = [0, 8, 60]; 
  const targetTooth = selectedTooth || focusedTooth || (noControls && treatments?.length > 0 ? treatments[0].tooth_number : null);

  if (targetTooth) {
    const tNum = parseInt(targetTooth);
    if (!isNaN(tNum)) {
      if ((tNum >= 13 && tNum <= 18) || (tNum >= 43 && tNum <= 48)) cameraPos = [-45, 8, 45];
      else if ((tNum >= 23 && tNum <= 28) || (tNum >= 33 && tNum <= 38)) cameraPos = [45, 8, 45];
      else cameraPos = [0, 6, 40];
    }
  }

  return (
    <div className="animate-fade" style={noControls ? { height: "100%", width: "100%" } : { display: "grid", gridTemplateColumns: "1.8fr 1fr", gap: 24, minHeight: 600 }}>
      <div className={noControls ? "" : "glass-panel"} style={{ position: "relative", background: noControls ? "transparent" : "#0a0f18", borderRadius: noControls ? 0 : 24, overflow: "hidden", border: "none" }}>
        {!noControls && (
          <button onClick={() => setAutoRotate(!autoRotate)} style={{ position: 'absolute', top: 20, right: 20, zIndex: 10, background: autoRotate ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)', color: autoRotate ? '#3b82f6' : 'white', padding: '8px 16px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
            {autoRotate ? t("⏸️ إيقاف") : t("🎬 دوران")}
          </button>
        )}
        <ErrorBoundary>
          <Suspense fallback={<div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", color: "white" }}>{t("جاري تحميل النموذج...")}</div>}>
            <Canvas shadows camera={{ position: cameraPos, fov: 45 }} alpha={true} gl={{ antialias: true, alpha: true }}>
              <ambientLight intensity={1.2} />
              <pointLight position={[10, 10, 10]} intensity={1.5} />
              <spotLight position={[-10, 10, 10]} angle={0.15} penumbra={1} intensity={1} />
              <Center top={noControls ? false : true}>
                <Model 
                   url="second.glb" 
                   onToothSelect={(id, raw) => {
                     if (noControls) return;
                     setSelectedTooth(id);
                     setSelectedToothRaw(raw);
                     if (onToothClick) onToothClick(id);
                   }} 
                   toothStatus={localData} 
                   treatments={treatments}
                   noControls={noControls}
                   focusedTooth={focusedTooth}
                   updateKey={updateKey}
                />
              </Center>
              {!noControls && <OrbitControls autoRotate={autoRotate} enablePan={false} minDistance={3} maxDistance={500} />}
              <Environment preset="city" />
            </Canvas>
          </Suspense>
        </ErrorBoundary>
      </div>

      {!noControls && (
        <div className="glass-panel" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>🛠️ {t("تحكم السن")}</h3>
          {selectedTooth ? (
             <div className="animate-fade">
               <div style={{ background: "rgba(0,210,255,0.1)", padding: 12, borderRadius: 12, marginBottom: 16, textAlign: "center", color: "var(--primary)", fontWeight: 800 }}>
                 {t("السن المختار")}: #{selectedTooth}
                 <div style={{ fontSize: 10, opacity: 0.6, marginTop: 4, fontWeight: 400 }}>Mesh: {selectedToothRaw}</div>
               </div>
               
               <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
                  {Object.entries(statusColors).map(([name, color]) => (
                    <button key={name} onClick={() => setSelectedStatus(name)} style={{ flex: 1, minWidth: "80px", padding: "8px", borderRadius: 10, fontSize: 11, border: "none", cursor: "pointer", background: selectedStatus === name ? color : "rgba(255,255,255,0.05)", color: selectedStatus === name ? "white" : "var(--text-muted)", fontWeight: 700 }}>{t(name)}</button>
                  ))}
               </div>

               <button className="btn-primary" style={{ width: "100%", marginBottom: 12 }} onClick={applyStatus}>
                 {t("تطبيق التشخيص على السن")}
               </button>

               <button className="btn-secondary" style={{ width: "100%" }} onClick={() => onToothClick && onToothClick(selectedTooth)}>
                 {t("جلسة جديدة لهذا السن 🛠️")}
               </button>

               {/* 🦷 السجل التاريخي للسن المختار */}
               {toothTreatments.length > 0 && (
                 <div className="animate-fade" style={{ marginTop: 20, padding: 12, background: "rgba(255,255,255,0.02)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.05)" }}>
                   <div style={{ fontSize: 13, color: "var(--primary)", marginBottom: 12, fontWeight: 700 }}>📜 {t("التاريخ الطبي للسن")}:</div>
                   <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 200, overflowY: "auto", paddingRight: 5 }}>
                     {toothTreatments.map((tr, i) => (
                       <div key={i} style={{ paddingBottom: 10, borderBottom: i < toothTreatments.length - 1 ? "1px dashed rgba(255,255,255,0.1)" : "none" }}>
                         <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{tr.date}</div>
                         <div style={{ fontSize: 14, fontWeight: 700, color: "white", marginTop: 2 }}>{tr.procedure}</div>
                         {tr.notes && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{tr.notes}</div>}
                       </div>
                     ))}
                   </div>
                 </div>
               )}
            </div>
          ) : (
            <div className="animate-fade" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
              <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", background: "rgba(255,255,255,0.02)", borderRadius: 16, marginBottom: 20 }}>
                <div style={{ fontSize: 30, marginBottom: 8 }}>🖱️</div>
                <div style={{ fontSize: 13 }}>{t("انقر على السن في الموديل لتغيير حالته أو بدء جلسة")}</div>
              </div>
              
              {/* 🦷 السجل التاريخي لجميع الأسنان */}
              {(treatments || []).length > 0 ? (
                 <div style={{ flex: 1, padding: 12, background: "rgba(255,255,255,0.02)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.05)" }}>
                   <div style={{ fontSize: 13, color: "var(--primary)", marginBottom: 12, fontWeight: 700 }}>📜 {t("السجل العام لجميع الأسنان")}:</div>
                   <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 350, overflowY: "auto", paddingRight: 5 }}>
                     {(treatments || []).map((tr, i) => (
                       <div key={i} style={{ paddingBottom: 10, borderBottom: i < treatments.length - 1 ? "1px dashed rgba(255,255,255,0.1)" : "none" }}>
                         <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                           <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{tr.date}</div>
                           <div style={{ fontSize: 11, background: "var(--primary)", padding: "2px 6px", borderRadius: 6, fontWeight: 800 }}>#{tr.tooth_number}</div>
                         </div>
                         <div style={{ fontSize: 14, fontWeight: 700, color: "white", marginTop: 2 }}>{tr.procedure}</div>
                         {tr.notes && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{tr.notes}</div>}
                       </div>
                     ))}
                   </div>
                 </div>
              ) : (
                 <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 12 }}>
                   {t("لا توجد إجراءات طبية سابقة")}
                 </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
