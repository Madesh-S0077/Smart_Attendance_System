import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import apiClient from "../api/client";
import { ApiResponse } from "../types";

const isTauriEnv =
  typeof window !== "undefined" &&
  (window as any).__TAURI_INTERNALS__ !== undefined;

export function useGeofence() {
  const [ssid, setSsid] = useState<string | null>(null);
  const [isOnCampus, setIsOnCampus] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date>(new Date());
  const [allowedSsids, setAllowedSsids] = useState<string[]>(["RMKEC", "RMKEC2G"]);

  const fetchAllowedSsids = async () => {
    try {
      const response = await apiClient.get<ApiResponse<string[]>>("/api/admin/ssid-config");
      if (response.data.success && response.data.data) {
        setAllowedSsids(response.data.data);
      }
    } catch (err) {
      console.warn("Failed to fetch custom SSID config, using defaults:", err);
    }
  };

  const checkWifi = async () => {
    let currentSsid: string | null = null;
    if (isTauriEnv) {
      try {
        const res = await invoke<string | null>("get_wifi_ssid");
        currentSsid = res;
      } catch (err) {
        console.error("Failed to fetch SSID via Tauri command:", err);
      }
    } else {
      currentSsid = "RMKEC";
    }

    setSsid(currentSsid);
    setIsOnCampus(currentSsid ? allowedSsids.includes(currentSsid) : false);
    setLastChecked(new Date());
  };

  useEffect(() => {
    const init = async () => {
      await fetchAllowedSsids();
      await checkWifi();
    };
    init();

    const interval = setInterval(checkWifi, 30000);
    return () => clearInterval(interval);
  }, []);

  return { ssid, isOnCampus, lastChecked, refetch: checkWifi };
}
