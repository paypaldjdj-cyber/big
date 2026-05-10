import { createContext, useContext, useState, useEffect } from "react";
import { getSettings } from "./api";
import { useAuth } from "./AuthContext";

export const SettingsContext = createContext();

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState({});
  const { user } = useAuth();

  const refreshSettings = () => {
    if (!user) return;
    getSettings().then(setSettings).catch(e => console.error("Settings Error:", e));
  };

  useEffect(() => {
    if (user) refreshSettings();
    else setSettings({});
  }, [user]);

  return (
    <SettingsContext.Provider value={{ settings, refreshSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
