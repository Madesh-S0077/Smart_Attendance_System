import apiClient from "./client";
import { ApiResponse, Student } from "../types";

export const studentsApi = {
  getMe: () => apiClient.get<ApiResponse<Student>>("/students/me"),

  getAll: (params?: { department?: string; section?: string }) =>
    apiClient.get<ApiResponse<Student[]>>("/students", { params }),

  getById: (id: string) => apiClient.get<ApiResponse<Student>>(`/students/${id}`),

  registerFace: (embedding: number[]) =>
    apiClient.post<ApiResponse<Student>>("/students/me/face", { embedding }),

  updateProfile: (data: Partial<Pick<Student, "name" | "department" | "section">>) =>
    apiClient.patch<ApiResponse<Student>>("/students/me", data),
};
