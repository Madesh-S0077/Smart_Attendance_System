import { create } from "zustand";
import { Store } from "@tauri-apps/plugin-store";
import { UserRole } from "../types";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  is_active?: boolean;
  created_at?: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;

  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => Promise<void>;
  clearAuth: () => Promise<void>;
  hasRole: (role: UserRole) => boolean;
}

const isTauriEnv = typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__ !== undefined;

const getTauriStore = async () => {
  if (isTauriEnv) {
    try {
      return await Store.load("auth.dat");
    } catch (err) {
      console.error("Failed to load auth.dat:", err);
    }
  }
  return null;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,

  setAuth: async (user, accessToken, refreshToken) => {
    localStorage.setItem("access_token", accessToken);
    localStorage.setItem("refresh_token", refreshToken);
    set({ user, accessToken, refreshToken, isAuthenticated: true });

    const store = await getTauriStore();
    if (store) {
      try {
        await store.set("auth", { user, access_token: accessToken, refresh_token: refreshToken });
        await store.save();
      } catch (err) {
        console.error("Tauri store save failed:", err);
      }
    }
  },

  clearAuth: async () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });

    const store = await getTauriStore();
    if (store) {
      try {
        await store.delete("auth");
        await store.save();
      } catch (err) {
        console.error("Tauri store delete failed:", err);
      }
    }
  },

  hasRole: (role) => get().user?.role === role,
}));

// Initialize store from Tauri Store plugin on startup
export const initAuthStore = async () => {
  const store = await getTauriStore();
  if (store) {
    try {
      const data = await store.get<{ user: AuthUser; access_token: string; refresh_token: string }>("auth");
      if (data) {
        localStorage.setItem("access_token", data.access_token);
        localStorage.setItem("refresh_token", data.refresh_token);
        useAuthStore.setState({
          user: data.user,
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          isAuthenticated: true,
        });
      }
    } catch (err) {
      console.error("Failed to load auth store from Tauri Store:", err);
    }
  } else {
    // Fallback to localStorage in web dev mode
    const access = localStorage.getItem("access_token");
    const refresh = localStorage.getItem("refresh_token");
    if (access && refresh) {
      useAuthStore.setState({
        accessToken: access,
        refreshToken: refresh,
        isAuthenticated: true,
        // user will be populated after api login
      });
    }
  }
};
