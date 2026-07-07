import apiClient from "./client";
import { ApiResponse, Teacher } from "../types";

export const teachersApi = {
  getMe: () => apiClient.get<ApiResponse<Teacher>>("/teachers/me"),

  getAll: (params?: { department?: string }) =>
    apiClient.get<ApiResponse<Teacher[]>>("/teachers", { params }),

  getById: (id: string) => apiClient.get<ApiResponse<Teacher>>(`/teachers/${id}`),

  getMyCounsellees: () =>
    apiClient.get<ApiResponse<import("../types").Student[]>>("/teachers/me/counsellees"),
};
