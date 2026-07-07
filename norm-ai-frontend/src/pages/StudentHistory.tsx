import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar, AlertCircle } from "lucide-react";
import apiClient from "../api/client";
import { ApiResponse } from "../types";
import SkeletonLoader from "../components/common/SkeletonLoader";

interface AttendanceLogItem {
  id: string;
  slot_id: string;
  date: string; // YYYY-MM-DD
  status: "present" | "absent";
  marked_at: string | null;
}

interface HolidayItem {
  id: string;
  date: string; // YYYY-MM-DD
  reason: string | null;
}

export default function StudentHistory() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [logs, setLogs] = useState<AttendanceLogItem[]>([]);
  const [holidays, setHolidays] = useState<HolidayItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch student logs and holidays
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [logsResp, holidaysResp] = await Promise.all([
          apiClient.get<ApiResponse<AttendanceLogItem[]>>("/api/attendance/logs"),
          apiClient.get<ApiResponse<HolidayItem[]>>("/api/holidays/"),
        ]);

        if (logsResp.data.success && logsResp.data.data) {
          setLogs(logsResp.data.data);
        }
        if (holidaysResp.data.success && holidaysResp.data.data) {
          setHolidays(holidaysResp.data.data);
        }
      } catch (err) {
        console.error("Failed to fetch history logs or holidays:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

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
  // Offset cells for previous month
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push(null);
  }
  // Days of current month
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

  // Compute metrics for active month
  let presentCount = 0;
  let absentCount = 0;

  logs.forEach((log) => {
    const logDate = new Date(log.date);
    if (logDate.getFullYear() === year && logDate.getMonth() === month) {
      if (log.status === "present") presentCount++;
      else if (log.status === "absent") absentCount++;
    }
  });

  const totalSlots = presentCount + absentCount;
  const attendancePercentage = totalSlots > 0 ? Math.round((presentCount / totalSlots) * 100) : 100;

  // Render SVG Ring Chart parameters
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (attendancePercentage / 100) * circumference;

  const getDayStatus = (cellDate: Date) => {
    const dateStr = formatDateString(cellDate);

    // Check Sunday
    if (cellDate.getDay() === 0) {
      return { type: "sunday", label: "Sunday", color: "bg-slate-100 text-slate-400" };
    }

    // Check Holiday
    const isHoliday = holidays.find((h) => h.date === dateStr);
    if (isHoliday) {
      return { type: "holiday", label: `Holiday: ${isHoliday.reason || "Break"}`, color: "bg-amber-100 text-amber-800" };
    }

    // Check Attendance logs
    const logItem = logs.find((l) => l.date === dateStr);
    if (logItem) {
      if (logItem.status === "present") {
        return { type: "present", label: "Present ✓", color: "bg-green-500 text-white font-bold" };
      } else {
        return { type: "absent", label: "Absent ✗", color: "bg-red-500 text-white font-bold" };
      }
    }

    return { type: "none", label: "", color: "bg-white text-[#1E293B] border border-[#E2E8F0]" };
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header title */}
      <div>
        <h1 className="text-2xl font-extrabold text-[#1E293B] flex items-center gap-2">
          <Calendar className="w-6 h-6 text-[#5B5FEF]" />
          Attendance History
        </h1>
        <p className="text-[#64748B] text-sm mt-1">View monthly summaries and tracking logs</p>
      </div>

      {isLoading ? (
        <div className="flex flex-col md:flex-row gap-8">
          <div className="flex-1">
            <SkeletonLoader type="calendar" />
          </div>
          <div className="w-full md:w-[280px]">
            <SkeletonLoader type="table" rows={3} />
          </div>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-8">
          {/* Left: Monthly Calendar */}
          <div className="flex-1 bg-white border border-[#E2E8F0] rounded-3xl p-6 shadow-md">
            {/* Month selector */}
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={handlePrevMonth}
                className="w-10 h-10 border border-[#E2E8F0] hover:bg-[#F8FAFC] rounded-xl flex items-center justify-center text-[#64748B] transition-all"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h2 className="text-lg font-extrabold text-[#1E293B]">
                {monthNames[month]} {year}
              </h2>
              <button
                onClick={handleNextMonth}
                className="w-10 h-10 border border-[#E2E8F0] hover:bg-[#F8FAFC] rounded-xl flex items-center justify-center text-[#64748B] transition-all"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-[#64748B] mb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="py-2">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {calendarCells.map((cell, index) => {
                if (cell === null) {
                  return <div key={`empty-${index}`} className="aspect-square"></div>;
                }

                const isToday = formatDateString(new Date()) === formatDateString(cell);
                const status = getDayStatus(cell);

                return (
                  <div
                    key={cell.getTime()}
                    title={status.label}
                    className={`aspect-square flex items-center justify-center rounded-2xl text-xs relative cursor-default select-none transition-all ${
                      status.color
                    } ${isToday ? "ring-2 ring-[#5B5FEF] ring-offset-2" : ""}`}
                  >
                    {cell.getDate()}
                  </div>
                );
              })}
            </div>

            {/* Color Guides */}
            <div className="flex flex-wrap gap-4 mt-6 pt-6 border-t border-[#F1F5F9] text-xs font-semibold text-[#64748B]">
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 bg-green-500 rounded-lg"></span> Present
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 bg-red-500 rounded-lg"></span> Absent
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 bg-amber-100 border border-amber-300 rounded-lg"></span> Holiday
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 bg-slate-100 rounded-lg"></span> Sunday
              </div>
            </div>
          </div>

          {/* Right: Percent Circle Badge & Stats */}
          <div className="w-full md:w-[280px] bg-white border border-[#E2E8F0] rounded-3xl p-6 shadow-md flex flex-col items-center justify-center text-center">
            <h3 className="text-sm font-bold text-[#1E293B] mb-6">Attendance Rating</h3>

            {/* Inline SVG circle chart */}
            <div className="relative w-32 h-32 flex items-center justify-center mb-6">
              <svg className="w-full h-full transform -rotate-90">
                {/* Background ring */}
                <circle
                  cx="64"
                  cy="64"
                  r={radius}
                  className="stroke-[#E2E8F0]"
                  strokeWidth="10"
                  fill="transparent"
                />
                {/* Progress ring */}
                <circle
                  cx="64"
                  cy="64"
                  r={radius}
                  className="stroke-[#5B5FEF] transition-all duration-500 ease-out"
                  strokeWidth="10"
                  fill="transparent"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-2xl font-extrabold text-[#1E293B]">
                  {attendancePercentage}%
                </span>
                <span className="text-[10px] text-[#64748B] font-bold uppercase tracking-wider">
                  this month
                </span>
              </div>
            </div>

            <div className="w-full space-y-3 text-xs font-semibold text-[#64748B]">
              <div className="flex justify-between py-2 border-b border-[#F1F5F9]">
                <span>Days Present:</span>
                <span className="text-green-600 font-bold">{presentCount} days</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#F1F5F9]">
                <span>Days Absent:</span>
                <span className="text-red-500 font-bold">{absentCount} days</span>
              </div>
              <div className="flex justify-between py-2">
                <span>Total Classes Logged:</span>
                <span className="text-[#1E293B] font-bold">{totalSlots}</span>
              </div>
            </div>

            {attendancePercentage < 75 && (
              <div className="mt-6 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-[10px] font-bold flex items-center gap-1.5 text-left">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>Warning: Attendance below RMKEC threshold (75%)!</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
