import React from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../LanguageContext";

export default function ConfirmModal({ show, title, message, onConfirm, onCancel, confirmText, cancelText, danger }) {
  const { t } = useLanguage();
  if (!show) return null;

  const isMobile = document.body.classList.contains("mobile-mode");

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 20 }}>
      <div className="glass-panel animate-fade" style={{ width: "100%", maxWidth: 400, padding: isMobile ? 16 : 32, textAlign: "center" }}>
        <h3 style={{ fontSize: 20, marginBottom: 16 }}>{title}</h3>
        <p style={{ marginBottom: 30, fontSize: 16, color: "var(--text-muted)" }}>{message}</p>
        <div style={{ display: "flex", gap: 12 }}>
          <button className="btn-ghost" style={{ flex: 1 }} onClick={onCancel}>{cancelText || t("إلغاء")}</button>
          <button className="btn-primary" style={{ flex: 1, background: danger ? "#ef4444" : "var(--primary)" }} onClick={onConfirm}>{confirmText || t("تأكيد")}</button>
        </div>
      </div>
    </div>
  , document.body);
}
