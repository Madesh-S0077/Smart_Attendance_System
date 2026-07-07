import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { GraduationCap, Search, Filter, Eye } from "lucide-react";
import apiClient from "../api/client";
import { ApiResponse } from "../types";
import SkeletonLoader from "../components/common/SkeletonLoader";

interface TeacherRow {
  id: string;
  name: string;
  department: string;
  position: string;
  student_count: number;
}

export default function AdminTeachers() {
  const navigate = useNavigate();
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [filteredTeachers, setFilteredTeachers] = useState<TeacherRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search/Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState("");

  const fetchTeachers = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.get<ApiResponse<TeacherRow[]>>("/api/admin/all-teachers");
      if (response.data.success && response.data.data) {
        setTeachers(response.data.data);
      }
    } catch (err) {
      console.error("Failed to load teachers roster:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  // Filter logic
  useEffect(() => {
    let result = [...teachers];

    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.position.toLowerCase().includes(query)
      );
    }

    if (deptFilter !== "") {
      result = result.filter((t) => t.department === deptFilter);
    }

    setFilteredTeachers(result);
  }, [teachers, searchQuery, deptFilter]);

  const handleViewStudents = (teacherName: string) => {
    // Navigate to students list pre-filtering by counsellor name via query parameter
    navigate(`/admin/students?counsellor=${encodeURIComponent(teacherName)}`);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1E293B] flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-[#5B5FEF]" />
            Faculty Directory
          </h1>
          <p className="text-[#64748B] text-sm mt-1">Manage teacher records and counsellee assignments</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B] w-4.5 h-4.5" />
          <input
            type="text"
            placeholder="Search by faculty name or position..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-[#E2E8F0] focus:ring-2 focus:ring-[#5B5FEF] rounded-xl text-xs bg-[#F8FAFC]"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[#64748B]" />
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
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-[#E2E8F0] shadow-sm overflow-hidden">
        {isLoading ? (
          <SkeletonLoader type="table" />
        ) : filteredTeachers.length === 0 ? (
          <div className="text-center py-16 text-sm text-[#64748B]">No teachers registered in system.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs text-[#64748B]">
              <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] font-bold text-[#1E293B]">
                <tr>
                  <th className="p-4">Name</th>
                  <th className="p-4">Department</th>
                  <th className="p-4">Position</th>
                  <th className="p-4 text-center">Counselled Students</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9] font-medium text-[#1E293B]">
                {filteredTeachers.map((teacher) => (
                  <tr key={teacher.id} className="hover:bg-[#F8FAFC]/50 transition-all">
                    <td className="p-4 font-bold">{teacher.name}</td>
                    <td className="p-4">{teacher.department}</td>
                    <td className="p-4 font-semibold text-[#64748B]">{teacher.position}</td>
                    <td className="p-4 text-center font-bold text-[#5B5FEF]">{teacher.student_count}</td>
                    <td className="p-4 flex justify-center">
                      <button
                        onClick={() => handleViewStudents(teacher.name)}
                        className="px-3 py-1.5 border border-[#5B5FEF] text-[#5B5FEF] hover:bg-[#5B5FEF]/5 rounded-xl text-[10px] font-bold transition-all flex items-center gap-1 active:scale-95"
                      >
                        <Eye className="w-3.5 h-3.5" /> View Students
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
