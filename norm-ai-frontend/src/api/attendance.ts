import apiClient from "./client";
import { ApiResponse, AttendanceLog, AttendanceMarkRequest, TimeSlot } from "../types";

export const attendanceApi = {
  getTodaySlot: () =>
    apiClient.get<ApiResponse<TimeSlot>>("/attendance/slot/today"),

  markAttendance: (payload: AttendanceMarkRequest) =>
    apiClient.post<ApiResponse<AttendanceLog>>("/attendance/mark", payload),

  getMyAttendance: (params?: { month?: string; year?: string }) =>
    apiClient.get<ApiResponse<AttendanceLog[]>>("/attendance/my", { params }),

  // Teacher endpoints
  getClassAttendance: (date: string, department?: string, section?: string) =>
    apiClient.get<ApiResponse<AttendanceLog[]>>("/attendance/class", {
      params: { date, department, section },
    }),

  overrideAttendance: (logId: string, status: "present" | "absent") =>
    apiClient.patch<ApiResponse<AttendanceLog>>(`/attendance/${logId}/override`, {
      status,
    }),

  // Admin endpoints
  getAttendanceSummary: (params?: {
    department?: string;
    section?: string;
    from_date?: string;
    to_date?: string;
  }) =>
    apiClient.get<ApiResponse<Record<string, unknown>>>("/attendance/summary", {
      params,
    }),
};
