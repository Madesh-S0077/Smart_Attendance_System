import { useState, useCallback } from "react";
import { attendanceApi } from "../api/attendance";
import { AttendanceLog, AttendanceMarkRequest, LivenessResult, TimeSlot } from "../types";

const LIVENESS_THRESHOLD = 0.65;

interface AttendanceState {
  todaySlot: TimeSlot | null;
  log: AttendanceLog | null;
  isLoading: boolean;
  error: string | null;
  isMarked: boolean;
}

export function useAttendance() {
  const [state, setState] = useState<AttendanceState>({
    todaySlot: null,
    log: null,
    isLoading: false,
    error: null,
    isMarked: false,
  });

  const fetchTodaySlot = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const { data: res } = await attendanceApi.getTodaySlot();
      if (!res.success) throw new Error(res.error ?? "Could not fetch today's attendance slot.");
      setState((s) => ({ ...s, todaySlot: res.data, isLoading: false }));
    } catch (err) {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to fetch slot.",
      }));
    }
  }, []);

  const markAttendance = useCallback(
    async (liveness: LivenessResult, slotId: string) => {
      if (!liveness.is_live || liveness.score < LIVENESS_THRESHOLD) {
        setState((s) => ({
          ...s,
          error: `Liveness check failed (score: ${liveness.score.toFixed(2)}). Please ensure your face is clearly visible and try again.`,
        }));
        return;
      }
      if (!liveness.embedding) {
        setState((s) => ({ ...s, error: "Face embedding not extracted. Please try again." }));
        return;
      }

      const payload: AttendanceMarkRequest = {
        embedding: liveness.embedding,
        liveness_score: liveness.score,
        slot_id: slotId,
      };

      setState((s) => ({ ...s, isLoading: true, error: null }));
      try {
        const { data: res } = await attendanceApi.markAttendance(payload);
        if (!res.success) {
          throw new Error(res.error ?? "Attendance marking failed.");
        }
        setState((s) => ({
          ...s,
          log: res.data,
          isMarked: true,
          isLoading: false,
        }));
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { error?: string } } }).response?.data?.error ??
          (err instanceof Error ? err.message : "Attendance marking failed.");
        setState((s) => ({ ...s, isLoading: false, error: message }));
      }
    },
    []
  );

  return { ...state, fetchTodaySlot, markAttendance };
}
