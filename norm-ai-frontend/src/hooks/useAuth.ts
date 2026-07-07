import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "../api/auth";
import { useAuthStore } from "../store/authStore";

export function useAuth() {
  const { user, isAuthenticated, setAuth, clearAuth, hasRole } = useAuthStore();
  const navigate = useNavigate();

  const login = useCallback(
    async (email: string, password: string) => {
      const { data: res } = await authApi.login(email, password);
      if (!res.success || !res.data) {
        throw new Error(res.error ?? "Login failed. Please check your credentials.");
      }
      const { user, access_token, refresh_token } = res.data;
      setAuth({ ...user, name: user.email.split("@")[0] }, access_token, refresh_token);

      // Route by role
      switch (user.role) {
        case "student":
          navigate("/student");
          break;
        case "teacher":
          navigate("/teacher");
          break;
        case "admin":
          navigate("/admin");
          break;
      }
    },
    [setAuth, navigate]
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // swallow — we always clear local state
    } finally {
      clearAuth();
      navigate("/login");
    }
  }, [clearAuth, navigate]);

  return { user, isAuthenticated, login, logout, hasRole };
}
