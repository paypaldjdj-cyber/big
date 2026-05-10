import React from "react";
import DrugManagement from "../components/DrugManagement";
import { useLanguage } from "../LanguageContext";

export default function DrugStore() {
  const { t } = useLanguage();
  
  return (
    <div className="animate-fade">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>💊 {t("إدارة الأدوية")}</h2>
      </div>
      
      <DrugManagement />
    </div>
  );
}
