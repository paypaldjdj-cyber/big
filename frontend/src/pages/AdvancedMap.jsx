import React, { Suspense, useState, useEffect, Component } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, Center, Environment } from "@react-three/drei";
import { useLanguage } from "../LanguageContext";

// مخطط السن المصغر بـ 5 أسطح
const ToothWidget = ({ surfaceStatus, onSurfaceClick }) => {
  const top = "0,0 100,0 75,25 25,25";
  const bottom = "0,100 100,100 75,75 25,75";
  const left = "0,0 25,25 25,75 0,100";
  const right = "100,0 75,25 75,75 100,100";
  
  const [hovered, setHovered] = useState(null);

  const getFill = (surface) => {
    if (surfaceStatus[surface] === 'caries') return "#ff4444";
    if (surfaceStatus[surface] === 'composite') return "#4444ff";
    if (surfaceStatus[surface] === 'crown') return "#ffd700";
    if (surfaceStatus[surface] === 'extraction') return "#222222";
    return hovered === surface ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.05)";
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '16px 0' }}>
      <svg viewBox="0 0 100 100" width="100" height="100" style={{ filter: 'drop-shadow(0px 4px 6px rgba(0,0,0,0.3))' }}>
        <polygon points={top} fill={getFill('top')} stroke="#1a1f2e" strokeWidth="2" onMouseEnter={() => setHovered('top')} onMouseLeave={() => setHovered(null)} onClick={() => onSurfaceClick('top')} style={{ cursor: 'pointer', transition: 'all 0.2s' }} />
        <polygon points={bottom} fill={getFill('bottom')} stroke="#1a1f2e" strokeWidth="2" onMouseEnter={() => setHovered('bottom')} onMouseLeave={() => setHovered(null)} onClick={() => onSurfaceClick('bottom')} style={{ cursor: 'pointer', transition: 'all 0.2s' }} />
        <polygon points={left} fill={getFill('left')} stroke="#1a1f2e" strokeWidth="2" onMouseEnter={() => setHovered('left')} onMouseLeave={() => setHovered(null)} onClick={() => onSurfaceClick('left')} style={{ cursor: 'pointer', transition: 'all 0.2s' }} />
        <polygon points={right} fill={getFill('right')} stroke="#1a1f2e" strokeWidth="2" onMouseEnter={() => setHovered('right')} onMouseLeave={() => setHovered(null)} onClick={() => onSurfaceClick('right')} style={{ cursor: 'pointer', transition: 'all 0.2s' }} />
        <rect x="25" y="25" width="50" height="50" fill={getFill('center')} stroke="#1a1f2e" strokeWidth="2" onMouseEnter={() => setHovered('center')} onMouseLeave={() => setHovered(null)} onClick={() => onSurfaceClick('center')} style={{ cursor: 'pointer', transition: 'all 0.2s' }} />
      </svg>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8 }}>M/D/B/L/O</div>
    </div>
  );
};

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: "#ef4444", padding: "40px 20px", textAlign: "center", width: "100%", fontFamily: "monospace" }}>
          <h3>⚠️ خطأ فني في تحميل الموديل</h3>
          <p style={{ direction: "ltr", background: "rgba(239,68,68,0.1)", padding: 10, borderRadius: 8 }}>
             {this.state.error?.message || "Unknown Error"}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

function Model({ url, onToothSelect, toothStatus }) {
  const { scene } = useGLTF(url);
  const [hovered, setHovered] = useState(null);

  React.useEffect(() => {
    scene.traverse((child) => {
      if (child.isMesh) {
        if (!child.userData.originalMaterial) {
          child.userData.originalMaterial = child.material.clone();
          child.material = child.material.clone();
        }

        const statusObj = toothStatus[child.name];
        let status = null;
        
        if (statusObj) {
           const values = Object.values(statusObj);
           if (values.includes('extraction')) status = 'extraction';
           else if (values.includes('crown')) status = 'crown';
           else if (values.includes('caries')) status = 'caries';
           else if (values.includes('composite')) status = 'composite';
        }

        if (status === 'caries') {
          child.material.color.setHex(0xff4444);
        } else if (status === 'composite') {
          child.material.color.setHex(0x4444ff);
        } else if (status === 'crown') {
          child.material.color.setHex(0xffd700);
        } else if (status === 'extraction') {
          child.material.color.setHex(0x222222);
        } else {
          child.material.color.copy(child.userData.originalMaterial.color);
        }
      }
    });
  }, [scene, toothStatus]);

  const handlePointerOver = (e) => {
    e.stopPropagation();
    setHovered(e.object.name);
    document.body.style.cursor = "pointer";
    if(e.object.material) {
      e.object.material.emissive.setHex(0x333333);
    }
  };

  const handlePointerOut = (e) => {
    e.stopPropagation();
    setHovered(null);
    document.body.style.cursor = "grab";
    if(e.object.material) {
      e.object.material.emissive.setHex(0x000000);
    }
  };

  const handleClick = (e) => {
    e.stopPropagation();
    if(onToothSelect) onToothSelect(e.object.name);
  };

  return (
    <primitive 
      object={scene} 
      scale={0.05}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    />
  );
}

import { saveTeeth } from "../api";

export default function AdvancedMap({ patientId, initialData = {} }) {
  const { t } = useLanguage();
  const [selectedTooth, setSelectedTooth] = useState(null);
  const [toothStatus, setToothStatus] = useState(initialData);
  const [activeProcedure, setActiveProcedure] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    console.log("ADVANCED_MAP: Initializing with data", initialData);
    if (initialData && Object.keys(initialData).length > 0) {
      setToothStatus(initialData);
    }
  }, [initialData]);

  useEffect(() => {
    console.log("ADVANCED_MAP: Current Status Updated", toothStatus);
  }, [toothStatus]);
  
  // زر الحركة السينمائية
  const [autoRotate, setAutoRotate] = useState(false);
  const [modelPath, setModelPath] = useState("second.glb"); 

  React.useEffect(() => {
    // Load model path from settings if exists
    const storedSettings = localStorage.getItem("clinic_settings");
    if (storedSettings) {
      try {
        const s = JSON.parse(storedSettings);
        if (s.tooth_model_url) setModelPath(s.tooth_model_url);
      } catch(e) {}
    }
  }, []);

  const handleSurfaceClick = (surface) => {
    if (!activeProcedure) {
      alert("يرجى اختيار إجراء طبي (تسوس، حشوة...) أولاً ثم النقر على السطح المطلوب.");
      return;
    }
    
    setToothStatus(prev => {
      const toothData = prev[selectedTooth] || {};
      return {
        ...prev,
        [selectedTooth]: {
          ...toothData,
          [surface]: activeProcedure
        }
      };
    });
  };

  const clearProcedure = () => {
    if (!selectedTooth) return;
    setToothStatus(prev => {
      const newState = { ...prev };
      delete newState[selectedTooth];
      return newState;
    });
  };

  const handleSave = async () => {
    if (!patientId) return;
    setIsSaving(true);
    try {
      await saveTeeth(patientId, toothStatus);
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: "تم حفظ الخريطة السنية بنجاح", type: "success" } }));
    } catch (e) {
      alert("Error saving teeth map");
    }
    setIsSaving(false);
  };

  const currentToothData = selectedTooth ? (toothStatus[selectedTooth] || {}) : {};

  return (
    <div className="animate-fade" style={{ display: "flex", flexDirection: "column", gap: 24, height: "calc(100vh - 120px)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>🦷 {t("الخريطة السنية ثلاثية الأبعاد")}</h2>
        <div style={{ display: "flex", gap: 12 }}>
          <button className="btn-primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "جاري الحفظ..." : "💾 حفظ حالة الأسنان"}
          </button>
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: 20, height: "100%" }}>
        <div className="glass-panel" style={{ flex: 3, position: "relative", overflow: "hidden", borderRadius: 24, background: "#111" }}>
          
          {/* زر التبديل للوضع السينمائي */}
          <button 
             onClick={() => setAutoRotate(!autoRotate)}
             style={{ 
               position: 'absolute', top: 20, right: 20, zIndex: 10, 
               background: autoRotate ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.1)', 
               color: autoRotate ? '#3b82f6' : 'white', 
               padding: '10px 20px', borderRadius: 20, 
               border: autoRotate ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.2)', 
               cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.3s',
               backdropFilter: 'blur(10px)', fontWeight: 600, fontSize: 14
             }}>
             {autoRotate ? '⏸️ إيقاف الدوران' : '🎬 عرض سينمائي'}
          </button>

          <ErrorBoundary>
            <Suspense fallback={<div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", color: "white" }}>{t("جاري تحميل النموذج...")}</div>}>
              <Canvas shadows camera={{ position: [0, 1, 7], fov: 50 }}>
                <ambientLight intensity={1.5} />
                <pointLight position={[10, 10, 10]} intensity={2} />
                <spotLight position={[-10, 10, 10]} angle={0.15} penumbra={1} intensity={2} />
                
                <Center>
                   <Model 
                     url={modelPath} 
                     onToothSelect={setSelectedTooth} 
                     toothStatus={toothStatus} 
                   />
                </Center>
                
                <OrbitControls 
                   makeDefault 
                   enablePan={false} 
                   minDistance={1.5} 
                   maxDistance={25} 
                   maxPolarAngle={Math.PI / 1.5} 
                   autoRotate={autoRotate}
                   autoRotateSpeed={1.5}
                />
                <Environment preset="city" />
              </Canvas>
            </Suspense>
          </ErrorBoundary>
        </div>

        <div className="glass-panel" style={{ flex: 1, minWidth: "350px", padding: 24, display: 'flex', flexDirection: 'column', gap: 20, overflowY: "auto" }}>
           <h3 style={{ margin: 0, color: 'var(--accent)' }}>📋 {t("الإجراءات الطبية (للحفظ)")}</h3>
           {selectedTooth ? (
             <div className="animate-fade">
               <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16, background: "rgba(255,255,255,0.02)", padding: 16, borderRadius: 16 }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--primary)', wordBreak: "break-all" }}>
                    تم تحديد السن
                  </div>
               </div>

               <ToothWidget surfaceStatus={currentToothData} onSurfaceClick={handleSurfaceClick} />

               <div style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 12, fontWeight: 'bold' }}>1. اختر الإجراء:</div>
               <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                 <button onClick={() => setActiveProcedure('caries')} className={activeProcedure === 'caries' ? 'btn-primary' : 'btn-secondary'} style={{ width: '100%', justifyContent: 'flex-start', padding: "10px 16px" }}>🔴 تسوس (Caries)</button>
                 <button onClick={() => setActiveProcedure('composite')} className={activeProcedure === 'composite' ? 'btn-primary' : 'btn-secondary'} style={{ width: '100%', justifyContent: 'flex-start', padding: "10px 16px" }}>🔵 حشوة (Composite)</button>
                 <button onClick={() => setActiveProcedure('crown')} className={activeProcedure === 'crown' ? 'btn-primary' : 'btn-secondary'} style={{ width: '100%', justifyContent: 'flex-start', padding: "10px 16px" }}>👑 تاج (Crown)</button>
                 <button onClick={() => setActiveProcedure('extraction')} className={activeProcedure === 'extraction' ? 'btn-primary' : 'btn-secondary'} style={{ width: '100%', justifyContent: 'flex-start', padding: "10px 16px" }}>⚫ قلع (Extraction)</button>
               </div>
               
               <div style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 12, fontWeight: 'bold' }}>2. انقر على السطح الدقيق في الرسمة أعلاه 👆</div>

               <button onClick={clearProcedure} className="btn-ghost" style={{ width: '100%', justifyContent: 'center', padding: "12px 16px", marginTop: 16 }}>إلغاء الإجراءات الطبية</button>
               
             </div>
           ) : (
             <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 20, padding: 32, background: "rgba(255,255,255,0.02)", borderRadius: 16 }}>
               👆 يرجى النقر على أي سن للبدء.
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
