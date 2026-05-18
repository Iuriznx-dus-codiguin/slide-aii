import { useEffect, useState } from "react";
import { loadDevSettings, type DevSettings } from "@/lib/devSettings";

/**
 * Hook reativo: sincroniza o estado das configurações dev em todas as telas
 * via CustomEvent local + storage event (cross-tab).
 */
export const useDevSettings = () => {
  const [settings, setSettings] = useState<DevSettings>(() => loadDevSettings());

  useEffect(() => {
    const onLocal = (e: Event) => {
      const ce = e as CustomEvent<DevSettings>;
      if (ce.detail) setSettings(ce.detail);
      else setSettings(loadDevSettings());
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === "slideai.devSettings") setSettings(loadDevSettings());
    };
    window.addEventListener("devsettings:changed", onLocal);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("devsettings:changed", onLocal);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return settings;
};
