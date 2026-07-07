import { useState, useEffect } from "react";
import { Users, Search, Download } from "lucide-react";
import apiClient from "../api/client";
import { ApiResponse } from "../types";
import SkeletonLoader from "../components/common/SkeletonLoader";
import { useToast } from "../context/ToastContext";

interface StudentRow {
  id: string;
  name: string;
  register_number: string;
  department: string;
  section: string;
  today_status: "present" | "absent" | "not_marked";
  marked_at: string | null;
  counsellor_name: string | null;
}

export default function AdminStudents() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<StudentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [todaySlotId, setTodaySlotId] = useState<string | null>(null);
  const [todaySlotName, setTodaySlotName] = useState<string | null>(null);
  const [isHoliday, setIsHoliday] = useState(false);

  // Search/Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

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
      const response = await apiClient.get<ApiResponse<StudentRow[]>>("/api/admin/all-students");
      if (response.data.success && response.data.data) {
        setStudents(response.data.data);
      }
    } catch (err) {
      console.error("Failed to load students roster:", err);
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

      const queryParams = new URLSearchParams(window.location.search);
      const counsellorParam = queryParams.get("counsellor");
      if (counsellorParam) {
        setSearchQuery(counsellorParam);
      }
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
          s.register_number.toLowerCase().includes(query) ||
          (s.counsellor_name && s.counsellor_name.toLowerCase().includes(query))
      );
    }

    if (deptFilter !== "") {
      result = result.filter((s) => s.department === deptFilter);
    }

    if (sectionFilter !== "") {
      result = result.filter((s) => s.section === sectionFilter);
    }

    if (statusFilter !== "") {
      result = result.filter((s) => s.today_status === statusFilter);
    }

    setFilteredStudents(result);
  }, [students, searchQuery, deptFilter, sectionFilter, statusFilter]);

  // Perform attendance override
  const handleOverride = async (studentId: string, status: "present" | "absent") => {
    if (isHoliday) {
      showToast("Cannot mark attendance on a holiday.", true);
      return;
    }
    if (!todaySlotId) {
      showToast("No active slot found for today yet.", true);
      return;
    }

    const originalStudents = [...students];

    // Optimistic update
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
      setStudents(originalStudents);
      showToast(err.response?.data?.error || "Override failed. Reverting changes.", true);
    }
  };

  // Client-side CSV Exporter
  const handleExportCSV = () => {
    const headers = ["Register Number", "Name", "Department", "Section", "Counsellor", "Today Status"];
    const rows = filteredStudents.map((s) => [
      s.register_number,
      s.name,
      s.department,
      s.section,
      s.counsellor_name || "Not Assigned",
      s.today_status,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.map(val => `"${val}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `students_attendance_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("CSV file exported successfully ✓");
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto relative">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1E293B] flex items-center gap-2">
            <Users className="w-6 h-6 text-[#5B5FEF]" />
            Student Administration
          </h1>
          <p className="text-[#64748B] text-sm mt-1">Oversee student rosters, counsellors, and logs</p>
        </div>

        <div className="flex gap-2">
          {todaySlotId && (
            <span className="px-4 py-2 bg-[#5B5FEF]/10 text-[#5B5FEF] text-xs font-extrabold rounded-xl border border-[#5B5FEF]/20 flex items-center">
              Session: {todaySlotName}
            </span>
          )}
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-[#5B5FEF] text-white text-xs font-extrabold rounded-xl hover:opacity-95 shadow-md flex items-center gap-1.5 transition-all active:scale-95"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Filters Bar */}
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
          {/* Department Filter */}
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="px-3 py-1.5 border border-[#E2E8F0] rounded-xl text-xs bg-[#F8FAFC]"
          >
            <option value="">All Departments</option>
            {["CSE", "ECE", "EEE", "MECH", "CIVIL", "IT", "AIDS", "AIML"].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {/* Section Filter */}
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

      {/* Student List Table */}
      <div className="bg-white rounded-3xl border border-[#E2E8F0] shadow-sm overflow-hidden">
        {isLoading ? (
          <SkeletonLoader type="table" />
        ) : filteredStudents.length === 0 ? (
          <div className="text-center py-16 text-sm text-[#64748B]">No students found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs text-[#64748B]">
              <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] font-bold text-[#1E293B]">
                <tr>
                  <th className="p-4">Name</th>
                  <th className="p-4">Register No.</th>
                  <th className="p-4">Dept</th>
                  <th className="p-4">Section</th>
                  <th className="p-4">Counsellor</th>
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

                  return (
                    <tr key={student.id} className="hover:bg-[#F8FAFC]/50 transition-all">
                      <td className="p-4 font-bold">{student.name}</td>
                      <td className="p-4 font-semibold text-[#64748B]">{student.register_number}</td>
                      <td className="p-4">{student.department}</td>
                      <td className="p-4 font-bold">{student.section}</td>
                      <td className="p-4 text-[#5B5FEF] font-semibold">
                        {student.counsellor_name || "Not Assigned"}
                      </td>
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
