import { useState, useEffect } from "react";
import { Wifi, MapPin, Calendar, Clock, RefreshCw, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";
import { useGeofence } from "../hooks/useGeofence";
import CameraModal from "../components/attendance/CameraModal";
import apiClient from "../api/client";
import { ApiResponse } from "../types";
import { formatDateTime } from "../utils/date";

interface TodayStatus {
  slot: {
    id: string;
    slot_name: string;
    start_time: string;
    end_time: string;
    date: string;
  };
  status: "present" | "absent" | "pending";
  marked_at: string | null;
  is_holiday: boolean;
  holiday_reason: string | null;
}

export default function StudentDashboardHome() {
  const { ssid, isOnCampus, lastChecked, refetch } = useGeofence();
  const [todaySlots, setTodaySlots] = useState<TodayStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<{ id: string; name: string } | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const fetchTodayStatus = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.get<ApiResponse<TodayStatus[]>>("/api/attendance/status");
      if (response.data.success && response.data.data) {
        setTodaySlots(response.data.data);
      }
    } catch (err) {
      console.error("Failed to load today's attendance status:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTodayStatus();
  }, []);

  const handleOpenScanner = (slotId: string, slotName: string) => {
    setSelectedSlot({ id: slotId, name: slotName });
    setIsCameraOpen(true);
  };

  const handleCloseScanner = () => {
    setIsCameraOpen(false);
    setSelectedSlot(null);
    fetchTodayStatus(); // Refresh attendance state
  };

  // Helper: check if a time slot is active right now
  const isTimeSlotActive = (startTime: string, endTime: string) => {
    const now = new Date();
    const [startH, startM] = startTime.split(":").map(Number);
    const [endH, endM] = endTime.split(":").map(Number);

    const start = new Date();
    start.setHours(startH, startM, 0, 0);

    const end = new Date();
    end.setHours(endH, endM, 0, 0);

    return now >= start && now <= end;
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* ── ZONE 1: GEOFENCE CARD ────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-[#E2E8F0] shadow-md p-6 relative overflow-hidden transition-all hover:shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {isOnCampus ? (
                <span className="flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-600 text-xs font-bold rounded-full border border-green-200">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                  Connected to RMKEC ✓
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-600 text-xs font-bold rounded-full border border-amber-200">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                  Not on campus network
                </span>
              )}
            </div>

            <h1 className="text-xl font-extrabold text-[#1E293B] flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#5B5FEF]" />
              RMKEC Attendance Zone
            </h1>

            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[#64748B] font-semibold mt-1">
              <span className="flex items-center gap-1">
                <Wifi className="w-3.5 h-3.5" /> SSID: <span className="font-bold text-[#1E293B]">{ssid || "Disconnected"}</span>
              </span>
              <span>•</span>
              <span>Last Checked: {lastChecked.toLocaleTimeString()}</span>
            </div>
          </div>

          <button
            onClick={refetch}
            className="px-4 py-2 border border-[#E2E8F0] text-xs font-bold text-[#64748B] hover:text-[#1E293B] hover:bg-[#F8FAFC] rounded-xl transition-all"
          >
            Check Connection
          </button>
        </div>

        {/* Attendance Button actions */}
        <div className="mt-6 pt-6 border-t border-[#F1F5F9] space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <RefreshCw className="w-6 h-6 text-[#5B5FEF] animate-spin" />
            </div>
          ) : todaySlots.length === 0 ? (
            <div className="p-4 bg-slate-50 border rounded-2xl text-center text-sm text-[#64748B]">
              No active attendance slots scheduled for today.
            </div>
          ) : (
            todaySlots.map((slotItem) => {
              const isHoliday = slotItem.is_holiday;
              const isMarked = slotItem.status === "present";
              const isActive = isTimeSlotActive(slotItem.slot.start_time, slotItem.slot.end_time);

              if (isHoliday) {
                return (
                  <div
                    key={slotItem.slot.id}
                    className="p-5 bg-amber-50/50 border border-amber-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600 flex-shrink-0">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-[#1E293B]">🎉 Today is a Holiday</h4>
                        <p className="text-xs text-[#64748B] mt-0.5">{slotItem.holiday_reason || "RMKEC Academic Break"}</p>
                      </div>
                    </div>
                    <button
                      disabled
                      className="px-6 py-2.5 bg-slate-100 text-slate-400 text-xs font-bold rounded-xl cursor-not-allowed"
                    >
                      Scanner Disabled
                    </button>
                  </div>
                );
              }

              return (
                <div
                  key={slotItem.slot.id}
                  className="p-5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:border-[#5B5FEF]/30"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-[#5B5FEF]/10 rounded-xl flex items-center justify-center text-[#5B5FEF] flex-shrink-0">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#1E293B]">{slotItem.slot.slot_name}</h4>
                      <p className="text-xs text-[#64748B] mt-0.5">
                        Time window: {slotItem.slot.start_time.slice(0, 5)} – {slotItem.slot.end_time.slice(0, 5)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {isMarked ? (
                      <span className="flex items-center gap-1 text-xs font-bold text-green-600">
                        <CheckCircle2 className="w-4 h-4" /> Marked Present
                      </span>
                    ) : !isActive ? (
                      <span className="text-xs text-[#64748B] font-semibold flex items-center gap-1">
                        <AlertCircle className="w-4 h-4 text-slate-400" /> Slot window closed/inactive
                      </span>
                    ) : !isOnCampus ? (
                      <button
                        title="You must connect to RMKEC WiFi to mark attendance."
                        disabled
                        className="px-5 py-2.5 bg-slate-200 text-slate-400 text-xs font-bold rounded-xl cursor-not-allowed flex items-center gap-1"
                      >
                        <Wifi className="w-3.5 h-3.5" /> Off-campus Blocked
                      </button>
                    ) : (
                      <button
                        onClick={() => handleOpenScanner(slotItem.slot.id, slotItem.slot.slot_name)}
                        className="px-6 py-2.5 bg-gradient-to-r from-[#5B5FEF] to-[#7B7DFF] text-white text-xs font-extrabold rounded-xl shadow-md hover:shadow-lg hover:opacity-95 active:scale-95 transition-all"
                      >
                        Mark Attendance
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── ZONE 2: TODAY'S ATTENDANCE SUMMARY CARD ───────────────────────────── */}
      <div className="bg-white rounded-3xl border border-[#E2E8F0] shadow-md p-6">
        <h2 className="text-lg font-bold text-[#1E293B] flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-[#5B5FEF]" />
          Today's Attendance Status
        </h2>

        <div className="grid md:grid-cols-2 gap-4">
          {isLoading ? (
            <div className="col-span-2 flex items-center justify-center py-6">
              <RefreshCw className="w-6 h-6 text-[#5B5FEF] animate-spin" />
            </div>
          ) : todaySlots.length === 0 ? (
            <div className="col-span-2 text-center text-sm py-4 text-[#64748B]">No slots scheduled for today.</div>
          ) : (
            todaySlots.map((slotItem) => {
              const isHoliday = slotItem.is_holiday;
              const status = slotItem.status;
              const markedAt = slotItem.marked_at;

              let badgeStyle = "bg-slate-100 text-slate-600 border-slate-200";
              let statusLabel = "Pending";

              if (isHoliday) {
                badgeStyle = "bg-amber-50 text-amber-700 border-amber-200";
                statusLabel = "Holiday";
              } else if (status === "present") {
                badgeStyle = "bg-green-50 text-green-700 border-green-200";
                statusLabel = "Present";
              } else if (status === "absent") {
                badgeStyle = "bg-red-50 text-red-700 border-red-200";
                statusLabel = "Absent";
              }

              return (
                <div
                  key={slotItem.slot.id}
                  className="p-4 border border-[#E2E8F0] rounded-2xl flex items-center justify-between bg-slate-50/50"
                >
                  <div className="space-y-1">
                    <span className="text-xs text-[#64748B] font-bold block">{slotItem.slot.slot_name}</span>
                    <span className="text-[10px] text-[#64748B] block">
                      {slotItem.slot.start_time.slice(0, 5)} - {slotItem.slot.end_time.slice(0, 5)}
                    </span>
                    {markedAt && (
                      <span className="text-[10px] text-green-600 font-semibold block">
                        Verified at {formatDateTime(markedAt)}
                      </span>
                    )}
                  </div>
                  <span className={`px-2.5 py-1 border text-xs font-bold rounded-lg ${badgeStyle}`}>
                    {statusLabel}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Camera verification Modal */}
      {selectedSlot && (
        <CameraModal
          isOpen={isCameraOpen}
          onClose={handleCloseScanner}
          slotId={selectedSlot.id}
          slotName={selectedSlot.name}
        />
      )}
    </div>
  );
}
