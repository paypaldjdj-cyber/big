import React, { createContext, useContext, useState, useEffect } from "react";
import { login as apiLogin, BASE } from "./api";

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("clinic_user");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.username) {
          setUser(parsed);
        }
      } catch (e) {
        localStorage.removeItem("clinic_user");
      }
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    try {
      // 1. تحاول الدخول عبر السيرفر أولاً
      const userData = await apiLogin({ username, password });
      
      // إذا نجح، نخزن البيانات للأوفلاين
      setUser(userData);
      localStorage.setItem("clinic_user", JSON.stringify(userData));
      localStorage.setItem("offline_creds", JSON.stringify({ username, password }));
      return userData;

    } catch (err) {
      // 2. نفحص نوع الخطأ: إذا كان خطأ شبكة (أوفلاين) ننتقل للدخول المحلي
      if (err.name === 'TypeError' || err.message.includes('fetch') || err.message === 'Offline' || !navigator.onLine) {
        console.log("Network error detected, trying offline login...");
        
        const lastUser = JSON.parse(localStorage.getItem("clinic_user") || "null");
        const lastCreds = JSON.parse(localStorage.getItem("offline_creds") || "null");

        if (lastCreds && lastCreds.username === username && lastCreds.password === password) {
          setUser(lastUser);
          return lastUser;
        } else {
          throw new Error(lastCreds ? "كلمة المرور غير مطابقة لآخر دخول مسجل (وضع أوفلاين)." : "لا توجد بيانات دخول مخزنة. يجب تسجيل الدخول مرة واحدة وأنت متصل بالسيرفر أولاً.");
        }
      }
      
      // 3. إذا كان الخطأ من السيرفر (مثل كلمة مرور خاطئة)، نظهره كما هو
      throw err;
    }

  };

  const logout = async () => {
    try {
      const saved = localStorage.getItem("clinic_user");
      const token = saved ? JSON.parse(saved)?.token : null;
      if (token) {
        await fetch(`${BASE}/auth/logout`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}` }
        });
      }
    } catch(e) {}
    setUser(null);
    localStorage.removeItem("clinic_user");
    window.location.href = "#/";
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, role: user?.role, clinic_id: user?.clinic_id }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() { 
    return useContext(AuthContext); 
}
