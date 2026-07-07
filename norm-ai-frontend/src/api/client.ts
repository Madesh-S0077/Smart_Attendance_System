import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "../store/authStore";
import { ApiResponse } from "../types";
import { showGlobalToast } from "../context/ToastContext";

const BASE_URL = "http://localhost:8000";

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 10000,
});

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().accessToken || localStorage.getItem("access_token");
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: string) => void;
  reject: (reason: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token!);
  });
  failedQueue = [];
}

apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
      __retryCount?: number;
    };

    const isGet = originalRequest?.method?.toLowerCase() === "get";
    const isNetworkError = !error.response;
    const isServerError = error.response && error.response.status >= 500;

    // Retry mechanism: 3 attempts with exponential backoff (1s, 2s, 4s) for GET requests only
    if (isGet && (isNetworkError || isServerError)) {
      originalRequest.__retryCount = originalRequest.__retryCount || 0;
      if (originalRequest.__retryCount < 3) {
        originalRequest.__retryCount += 1;
        const delay = Math.pow(2, originalRequest.__retryCount - 1) * 1000;
        console.warn(`[Axios Retry] Retrying GET ${originalRequest.url} (Attempt ${originalRequest.__retryCount}/3) in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return apiClient(originalRequest);
      }
    }

    // On network error: show toast
    if (isNetworkError) {
      showGlobalToast("Connection failed. Please check your network.", "error");
      return Promise.reject(error);
    }

    // Handle 401 token refresh
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((newToken) => {
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
        }
        return apiClient(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const refreshToken = useAuthStore.getState().refreshToken || localStorage.getItem("refresh_token");
      if (!refreshToken) throw new Error("No refresh token stored.");

      const { data } = await axios.post<ApiResponse<{ access_token: string }>>(
        `${BASE_URL}/api/auth/refresh`,
        {},
        {
          headers: {
            Authorization: `Bearer ${refreshToken}`,
          },
        }
      );

      if (!data.success || !data.data) {
        throw new Error(data.error || "Token refresh failed");
      }

      const { access_token } = data.data;

      // Update store state and localStorage
      const user = useAuthStore.getState().user;
      if (user) {
        await useAuthStore.getState().setAuth(user, access_token, refreshToken);
      } else {
        localStorage.setItem("access_token", access_token);
        useAuthStore.setState({ accessToken: access_token });
      }

      processQueue(null, access_token);

      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
      }
      return apiClient(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      showGlobalToast("Session expired, please sign in again", "error");
      
      // Clear store state & storage, then redirect to login
      await useAuthStore.getState().clearAuth();
      window.location.href = "/login";
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default apiClient;
