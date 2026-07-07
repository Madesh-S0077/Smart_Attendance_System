import apiClient from "./client";
import { ApiResponse, AuthTokens, User } from "../types";

export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post<ApiResponse<AuthTokens & { user: User }>>("/auth/login", {
      email,
      password,
    }),

  refresh: (refresh_token: string) =>
    apiClient.post<ApiResponse<AuthTokens>>("/auth/refresh", { refresh_token }),

  logout: () => apiClient.post<ApiResponse<null>>("/auth/logout"),

  me: () => apiClient.get<ApiResponse<User>>("/auth/me"),
};
