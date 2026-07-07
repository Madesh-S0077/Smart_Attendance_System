/**
 * Norm AI — Global TypeScript types
 * These mirror the backend Pydantic schemas exactly.
 */

// ── Auth ──────────────────────────────────────────────────────────────────────
export type UserRole = "student" | "teacher" | "admin";

export interface User {
  id: string; // UUID
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string; // ISO 8601
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
}

export interface LoginRequest {
  email: string;
  password: string;
}

// ── API envelope ──────────────────────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  error: string | null;
}

// ── Student ───────────────────────────────────────────────────────────────────
export interface Student {
  id: string;
  name: string;
  register_number: string;
  department: string;
  section: string;
  counsellor_id: string | null;
  has_face_embedding: boolean;
  created_at: string;
}

// ── Teacher ───────────────────────────────────────────────────────────────────
export interface Teacher {
  id: string;
  name: string;
  department: string;
  position: string;
}

// ── Attendance ────────────────────────────────────────────────────────────────
export type AttendanceStatus = "present" | "absent";
export type MarkedBy = "system" | "teacher";

export interface TimeSlot {
  id: string;
  date: string; // YYYY-MM-DD
  slot_name: string;
  start_time: string; // HH:MM:SS
  end_time: string;
}

export interface AttendanceLog {
  id: string;
  student_id: string;
  slot_id: string;
  date: string;
  status: AttendanceStatus;
  marked_at: string | null;
  marked_by: MarkedBy;
  face_match_score: number | null;
}

// ── Liveness / AI ─────────────────────────────────────────────────────────────
export interface LivenessResult {
  is_live: boolean;
  score: number; // 0.0–1.0; threshold is 0.65
  embedding: number[] | null; // 512-dim float32, null if not live
}

export interface AttendanceMarkRequest {
  embedding: number[]; // 512-dim from sidecar
  liveness_score: number;
  slot_id: string;
}

// ── Holiday ───────────────────────────────────────────────────────────────────
export interface Holiday {
  id: string;
  date: string;
  reason: string | null;
  created_by: string | null;
  created_at: string;
}
