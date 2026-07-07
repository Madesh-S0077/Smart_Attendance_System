import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar, X, AlertTriangle, Info, CheckCircle } from "lucide-react";
import apiClient from "../api/client";
import { ApiResponse } from "../types";

interface HolidayItem {
  id: string;
  date: string; // YYYY-MM-DD
  reason: string | null;
}

export default function TeacherHolidays() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [holidays, setHolidays] = useState<HolidayItem[]>([]);

  // Modal State
  const [selectedCellDate, setSelectedCellDate] = useState<Date | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [holidayReasonInput, setHolidayReasonInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Toast State
  const [toastMessage, setToastMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const showToast = (text: string, isError = false) => {
    setToastMessage({ text, isError });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchHolidays = async () => {
    try {
      const response = await apiClient.get<ApiResponse<HolidayItem[]>>("/api/holidays/");
      if (response.data.success && response.data.data) {
        setHolidays(response.data.data);
      }
    } catch (err) {
      console.error("Failed to load holidays:", err);
      showToast("Failed to fetch holidays.", true);
    }
  };

  useEffect(() => {
    fetchHolidays();
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setModalOpen(false);
      }
    };
    if (modalOpen) {
      window.addEventListener("keydown", handleEscape);
    }
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [modalOpen]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // Helper date metrics
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // Sunday = 0

  // Generate calendar days
  const calendarCells = [];
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarCells.push(new Date(year, month, d));
  }

  // Format date to YYYY-MM-DD
  const formatDateString = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const handleCellClick = (cellDate: Date) => {
    // Sundays are always non-clickable
    if (cellDate.getDay() === 0) return;

    setSelectedCellDate(cellDate);
    setHolidayReasonInput("");
    setModalOpen(true);
  };

  const handleAddHoliday = async () => {
    if (!selectedCellDate) return;
    setIsSubmitting(true);
    const dateStr = formatDateString(selectedCellDate);

    try {
      const response = await apiClient.post<ApiResponse<HolidayItem>>("/api/holidays/", {
        date: dateStr,
        reason: holidayReasonInput.trim() || null,
      });

      if (response.data.success && response.data.data) {
        setHolidays((prev) => [...prev, response.data.data!]);
        showToast("Holiday marked successfully ✓");
        setModalOpen(false);
      }
    } catch (err: any) {
      showToast(err.response?.data?.error || "Failed to set holiday.", true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveHoliday = async (dateStr: string) => {
    setIsSubmitting(true);
    try {
      const response = await apiClient.delete<ApiResponse<any>>(`/api/holidays/${dateStr}`);
      if (response.data.success) {
        setHolidays((prev) => prev.filter((h) => h.date !== dateStr));
        showToast("Holiday removed successfully ✓");
        setModalOpen(false);
      }
    } catch (err: any) {
      showToast(err.response?.data?.error || "Failed to remove holiday.", true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto relative">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`fixed top-6 right-6 z-[100] p-4 rounded-xl border shadow-xl flex items-center gap-2 font-bold text-sm transition-all duration-300 animate-slide-in ${
            toastMessage.isError
              ? "bg-red-50 border-red-200 text-red-600"
              : "bg-green-50 border-green-200 text-green-600"
          }`}
        >
          {toastMessage.isError ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
          {toastMessage.text}
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-[#1E293B] flex items-center gap-2">
          <Calendar className="w-6 h-6 text-[#5B5FEF]" />
          RMKEC Holiday Calendar
        </h1>
        <p className="text-[#64748B] text-sm mt-1">Configure and manage academic holiday schedules</p>
      </div>

      {/* Calendar Card container */}
      <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 shadow-md">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={handlePrevMonth}
            className="w-10 h-10 border border-[#E2E8F0] hover:bg-[#F8FAFC] rounded-xl flex items-center justify-center text-[#64748B] transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-extrabold text-[#1E293B]">
            {monthNames[month]} {year}
          </h2>
          <button
            onClick={handleNextMonth}
            className="w-10 h-10 border border-[#E2E8F0] hover:bg-[#F8FAFC] rounded-xl flex items-center justify-center text-[#64748B] transition-all"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Days Header */}
        <div className="grid grid-cols-7 gap-3 text-center text-xs font-bold text-[#64748B] mb-4">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Grid Cells */}
        <div className="grid grid-cols-7 gap-3">
          {calendarCells.map((cell, index) => {
            if (cell === null) {
              return <div key={`empty-${index}`} className="aspect-square"></div>;
            }

            const dateStr = formatDateString(cell);
            const isToday = formatDateString(new Date()) === dateStr;
            const isSunday = cell.getDay() === 0;

            // Search if registered holiday
            const registeredHoliday = holidays.find((h) => h.date === dateStr);

            let cellClass = "bg-white hover:bg-[#F1F5F9] cursor-pointer text-[#1E293B]";
            let borderStyle = "border border-[#E2E8F0]";

            if (isSunday) {
              cellClass = "bg-[#FEE2E2] text-[#EF4444] cursor-not-allowed";
              borderStyle = "border border-[#FCA5A5]";
            } else if (registeredHoliday) {
              cellClass = "bg-[#FEE2E2] text-[#EF4444] cursor-pointer hover:bg-[#FECACA]";
              borderStyle = "border-2 border-[#EF4444]";
            }

            if (isToday) {
              borderStyle = "border-2 border-[#5B5FEF]";
            }

            return (
              <div
                key={cell.getTime()}
                onClick={() => handleCellClick(cell)}
                title={registeredHoliday ? registeredHoliday.reason || "Holiday" : ""}
                className={`aspect-square flex flex-col justify-between p-2 rounded-2xl text-xs font-bold transition-all relative ${cellClass} ${borderStyle}`}
              >
                <span>{cell.getDate()}</span>
                {registeredHoliday && (
                  <span className="block text-[8px] text-[#EF4444] truncate max-w-full font-extrabold uppercase tracking-wider">
                    Holiday
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Holiday Dialog Modal */}
      {modalOpen && selectedCellDate && (() => {
        const dateStr = formatDateString(selectedCellDate);
        const activeHoliday = holidays.find((h) => h.date === dateStr);

        return (
          <div className="fixed inset-0 bg-[#1E293B]/60 flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white w-full max-w-[380px] rounded-3xl shadow-2xl p-6 relative border border-[#E2E8F0]">
              {/* Close X */}
              <button
                onClick={() => setModalOpen(false)}
                className="absolute top-4 right-4 text-[#64748B] hover:text-[#1E293B]"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-lg font-bold text-[#1E293B] mb-2 flex items-center gap-1.5">
                <Calendar className="w-5 h-5 text-[#5B5FEF]" />
                Holiday Config
              </h3>
              <p className="text-xs text-[#64748B] mb-4">
                Selected Date: <span className="font-bold text-[#1E293B]">{selectedCellDate.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</span>
              </p>

              {activeHoliday ? (
                <div className="space-y-4">
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-semibold flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <span>Holiday reason: {activeHoliday.reason || "RMKEC Academic Break"}</span>
                  </div>

                  <button
                    onClick={() => handleRemoveHoliday(dateStr)}
                    disabled={isSubmitting}
                    className="w-full h-10 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition-all active:scale-95 flex items-center justify-center disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      "Remove Holiday"
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#1E293B] mb-1.5">
                      Holiday Reason
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Republic Day"
                      value={holidayReasonInput}
                      onChange={(e) => setHolidayReasonInput(e.target.value)}
                      className="w-full px-4 py-2 border border-[#E2E8F0] focus:ring-2 focus:ring-[#5B5FEF] rounded-xl text-xs bg-[#F8FAFC]"
                    />
                  </div>

                  <button
                    onClick={handleAddHoliday}
                    disabled={isSubmitting}
                    className="w-full h-10 bg-[#5B5FEF] hover:bg-[#4B4FEF] text-white font-bold rounded-xl text-xs transition-all active:scale-95 flex items-center justify-center disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      "Mark as Holiday"
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
