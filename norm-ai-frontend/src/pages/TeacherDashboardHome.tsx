import { useState, useEffect } from "react";
import { Users, Search, Filter } from "lucide-react";
import apiClient from "../api/client";
import { ApiResponse } from "../types";
import SkeletonLoader from "../components/common/SkeletonLoader";
import { useToast } from "../context/ToastContext";

interface StudentAttendanceRow {
  id: string;
  name: string;
  register_number: string;
  section: string;
  today_status: "present" | "absent" | "not_marked";
  marked_at: string | null;
}

export default function TeacherDashboardHome() {
  const [students, setStudents] = useState<StudentAttendanceRow[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<StudentAttendanceRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [todaySlotId, setTodaySlotId] = useState<string | null>(null);
  const [todaySlotName, setTodaySlotName] = useState<string | null>(null);
  const [isHoliday, setIsHoliday] = useState(false);
  const [holidayReason, setHolidayReason] = useState<string | null>(null);

  // Search/Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Selection state for bulk actions
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  const toast = useToast();

  const showToast = (text: string, isError = false) => {
    if (isError) {
      toast.error(text);
    } else {
      toast.success(text);
    }
  };

  const fetchStudents = async () => {
    try {
      const response = await apiClient.get<ApiResponse<StudentAttendanceRow[]>>("/api/teachers/my-students");
      if (response.data.success && response.data.data) {
        setStudents(response.data.data);
      }
    } catch (err) {
      console.error("Failed to fetch students list:", err);
      showToast("Failed to fetch students roster.", true);
    }
  };

  const checkTodayEnvironment = async () => {
    setIsLoading(true);
    const todayStr = new Date().toISOString().split("T")[0];
    try {
      // 1. Check if today is a holiday
      const holidaysResp = await apiClient.get<ApiResponse<any[]>>("/api/holidays/");
      if (holidaysResp.data.success && holidaysResp.data.data) {
        const todayHoliday = holidaysResp.data.data.find((h) => h.date === todayStr);
        if (todayHoliday) {
          setIsHoliday(true);
          setHolidayReason(todayHoliday.reason || "Break");
        }
      }

      // 2. Fetch today's slot
      const slotResp = await apiClient.get<ApiResponse<any>>("/api/timeslots/today");
      if (slotResp.data.success && slotResp.data.data) {
        setTodaySlotId(slotResp.data.data.id);
        setTodaySlotName(slotResp.data.data.slot_name);
      }
    } catch (err) {
      console.error("Failed to load environment setup:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const boot = async () => {
      await checkTodayEnvironment();
      await fetchStudents();
    };
    boot();
  }, []);

  // Filter & Search logic
  useEffect(() => {
    let result = [...students];

    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.register_number.toLowerCase().includes(query)
      );
    }

    if (sectionFilter !== "") {
      result = result.filter((s) => s.section === sectionFilter);
    }

    if (statusFilter !== "") {
      result = result.filter((s) => s.today_status === statusFilter);
    }

    setFilteredStudents(result);
  }, [students, searchQuery, sectionFilter, statusFilter]);

  // Bulk checkboxes
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedStudentIds(filteredStudents.map((s) => s.id));
    } else {
      setSelectedStudentIds([]);
    }
  };

  const handleSelectRow = (studentId: string, checked: boolean) => {
    if (checked) {
      setSelectedStudentIds((prev) => [...prev, studentId]);
    } else {
      setSelectedStudentIds((prev) => prev.filter((id) => id !== studentId));
    }
  };

  // Perform single attendance status override
  const handleOverride = async (studentId: string, status: "present" | "absent") => {
    if (isHoliday) {
      showToast("Cannot mark attendance on a holiday.", true);
      return;
    }
    if (!todaySlotId) {
      showToast("No attendance time slot generated for today yet.", true);
      return;
    }

    const originalStudents = [...students];

    // Optimistic UI update
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, today_status: status } : s))
    );

    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const response = await apiClient.put<ApiResponse<any>>("/api/attendance/override", {
        student_id: studentId,
        slot_id: todaySlotId,
        date: todayStr,
        status: status,
      });

      if (!response.data.success) {
        throw new Error(response.data.error || "Override error");
      }
      showToast("Student status updated.");
    } catch (err: any) {
      // Revert optimistic updates on error
      setStudents(originalStudents);
      showToast(err.response?.data?.error || "Override failed. Reverting changes.", true);
    }
  };

  // Bulk actions updates
  const handleBulkOverride = async (status: "present" | "absent") => {
    if (isHoliday) {
      showToast("Cannot mark attendance on a holiday.", true);
      return;
    }
    if (!todaySlotId) {
      showToast("No active slot config found.", true);
      return;
    }

    const idsToUpdate = [...selectedStudentIds];
    if (idsToUpdate.length === 0) return;

    const originalStudents = [...students];

    // Optimistic bulk update
    setStudents((prev) =>
      prev.map((s) => (idsToUpdate.includes(s.id) ? { ...s, today_status: status } : s))
    );

    setSelectedStudentIds([]); // Clear selection UI

    let successCount = 0;
    const todayStr = new Date().toISOString().split("T")[0];

    for (let i = 0; i < idsToUpdate.length; i++) {
      const studentId = idsToUpdate[i];
      try {
        await apiClient.put<ApiResponse<any>>("/api/attendance/override", {
          student_id: studentId,
          slot_id: todaySlotId,
          date: todayStr,
          status,
        });
        successCount++;
        showToast(`Updated ${successCount} of ${idsToUpdate.length} students...`);
      } catch (err) {
        setStudents(originalStudents);
        showToast("Bulk update encountered an error. Reverting state.", true);
        break;
      }
    }
    fetchStudents();
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto relative">

      {/* Top Banner Overview */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1E293B] flex items-center gap-2">
            <Users className="w-6 h-6 text-[#5B5FEF]" />
            My Counsellee Students
          </h1>
          <p className="text-[#64748B] text-sm mt-1">Manage and override attendance rosters</p>
        </div>

        {/* Current Active Slot banner */}
        <div className="flex items-center gap-3">
          {isHoliday ? (
            <span className="px-4 py-2 bg-amber-50 text-amber-700 text-xs font-extrabold rounded-xl border border-amber-200">
              🎉 Today: Holiday ({holidayReason})
            </span>
          ) : todaySlotId ? (
            <span className="px-4 py-2 bg-[#5B5FEF]/10 text-[#5B5FEF] text-xs font-extrabold rounded-xl border border-[#5B5FEF]/20">
              Active Session: {todaySlotName}
            </span>
          ) : (
            <span className="px-4 py-2 bg-slate-100 text-slate-500 text-xs font-extrabold rounded-xl">
              No Slot Generated for Today
            </span>
          )}
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B] w-4.5 h-4.5" />
          <input
            type="text"
            placeholder="Search by name or register no..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-[#E2E8F0] focus:ring-2 focus:ring-[#5B5FEF] rounded-xl text-xs bg-[#F8FAFC]"
          />
        </div>

        <div className="flex flex-wrap gap-3 items-center w-full md:w-auto justify-end">
          {/* Section Filter */}
          <div className="flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-[#64748B]" />
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="px-3 py-1.5 border border-[#E2E8F0] rounded-xl text-xs bg-[#F8FAFC]"
            >
              <option value="">All Sections</option>
              <option value="A">Section A</option>
              <option value="B">Section B</option>
              <option value="C">Section C</option>
              <option value="D">Section D</option>
            </select>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 border border-[#E2E8F0] rounded-xl text-xs bg-[#F8FAFC]"
          >
            <option value="">All Statuses</option>
            <option value="present">Present</option>
            <option value="absent">Absent</option>
            <option value="not_marked">No Slot / Pending</option>
          </select>
        </div>
      </div>

      {/* Bulk actions bar (if selected) */}
      {selectedStudentIds.length > 0 && (
        <div className="bg-[#5B5FEF]/5 border border-[#5B5FEF]/20 p-4 rounded-2xl flex items-center justify-between animate-fade-in shadow-sm">
          <span className="text-xs font-bold text-[#5B5FEF]">
            Selected {selectedStudentIds.length} students
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => handleBulkOverride("absent")}
              className="px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold rounded-lg transition-all"
            >
              Mark Selected Absent
            </button>
            <button
              onClick={() => handleBulkOverride("present")}
              className="px-3.5 py-1.5 bg-[#5B5FEF] text-white hover:opacity-90 text-xs font-bold rounded-lg transition-all shadow-md"
            >
              Mark Selected Present
            </button>
          </div>
        </div>
      )}

      {/* Main Students Roster Table */}
      <div className="bg-white rounded-3xl border border-[#E2E8F0] shadow-sm overflow-hidden">
        {isLoading ? (
          <SkeletonLoader type="table" />
        ) : filteredStudents.length === 0 ? (
          <div className="text-center py-16 text-sm text-[#64748B]">No counsellee students match your filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs text-[#64748B]">
              <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] font-bold text-[#1E293B]">
                <tr>
                  <th className="p-4 w-12 text-center">
                    <input
                      type="checkbox"
                      onChange={handleSelectAll}
                      checked={
                        filteredStudents.length > 0 &&
                        selectedStudentIds.length === filteredStudents.length
                      }
                      className="rounded"
                    />
                  </th>
                  <th className="p-4">Name</th>
                  <th className="p-4">Register No.</th>
                  <th className="p-4">Section</th>
                  <th className="p-4">Today's Status</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9] font-medium text-[#1E293B]">
                {filteredStudents.map((student) => {
                  let badgeStyle = "bg-slate-100 text-slate-600 border-slate-200";
                  let statusLabel = "No Slot";

                  if (isHoliday) {
                    badgeStyle = "bg-amber-50 text-amber-700 border-amber-200";
                    statusLabel = "Holiday";
                  } else if (student.today_status === "present") {
                    badgeStyle = "bg-green-50 text-green-700 border-green-200";
                    statusLabel = "Present";
                  } else if (student.today_status === "absent") {
                    badgeStyle = "bg-red-50 text-red-700 border-red-200";
                    statusLabel = "Absent";
                  }

                  const isChecked = selectedStudentIds.includes(student.id);

                  return (
                    <tr
                      key={student.id}
                      className={`hover:bg-[#F8FAFC]/50 transition-all ${
                        isChecked ? "bg-[#5B5FEF]/5" : ""
                      }`}
                    >
                      <td className="p-4 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => handleSelectRow(student.id, e.target.checked)}
                          className="rounded"
                        />
                      </td>
                      <td className="p-4 font-bold">{student.name}</td>
                      <td className="p-4 font-semibold text-[#64748B]">{student.register_number}</td>
                      <td className="p-4 font-bold">A</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 border text-[10px] font-bold rounded-lg ${badgeStyle}`}>
                          {statusLabel}
                        </span>
                      </td>
                      <td className="p-4 flex gap-2 justify-center">
                        <button
                          onClick={() => handleOverride(student.id, "present")}
                          disabled={!todaySlotId || isHoliday}
                          className="px-2.5 py-1 border border-green-200 text-green-600 hover:bg-green-50 disabled:opacity-30 disabled:pointer-events-none rounded-lg text-[10px] font-bold transition-all"
                        >
                          Mark Present
                        </button>
                        <button
                          onClick={() => handleOverride(student.id, "absent")}
                          disabled={!todaySlotId || isHoliday}
                          className="px-2.5 py-1 border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:pointer-events-none rounded-lg text-[10px] font-bold transition-all"
                        >
                          Mark Absent
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
