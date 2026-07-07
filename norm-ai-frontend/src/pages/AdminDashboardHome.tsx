import { useState, useEffect } from "react";
import { Users, GraduationCap, CheckCircle, XCircle, Clock } from "lucide-react";
import apiClient from "../api/client";
import { ApiResponse } from "../types";
import SkeletonLoader from "../components/common/SkeletonLoader";
import { formatDateTime } from "../utils/date";

interface StatsData {
  total_students: number;
  total_teachers: number;
  today_present: number;
  today_absent: number;
  holidays_this_month: number;
}

interface RecentActivityRow {
  marked_at: string | null;
  student_name: string;
  register_number: string;
  status: string;
  method: string;
}

export default function AdminDashboardHome() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [recentLogs, setRecentLogs] = useState<RecentActivityRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const [statsResp, logsResp] = await Promise.all([
        apiClient.get<ApiResponse<StatsData>>("/api/admin/stats"),
        apiClient.get<ApiResponse<RecentActivityRow[]>>("/api/admin/recent-activity"),
      ]);

      if (statsResp.data.success && statsResp.data.data) {
        setStats(statsResp.data.data);
      }
      if (logsResp.data.success && logsResp.data.data) {
        setRecentLogs(logsResp.data.data);
      }
    } catch (err) {
      console.error("Failed to load admin dashboard summary:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-8 max-w-6xl mx-auto">
        <SkeletonLoader type="cards" />
        <SkeletonLoader type="table" />
      </div>
    );
  }

  const statCards = [
    {
      title: "Total Students",
      value: stats?.total_students ?? 0,
      icon: Users,
      color: "text-[#5B5FEF] bg-[#5B5FEF]/10 border-[#5B5FEF]/20",
    },
    {
      title: "Total Teachers",
      value: stats?.total_teachers ?? 0,
      icon: GraduationCap,
      color: "text-purple-600 bg-purple-50 border-purple-200",
    },
    {
      title: "Present Today",
      value: stats?.today_present ?? 0,
      icon: CheckCircle,
      color: "text-green-600 bg-green-50 border-green-200",
    },
    {
      title: "Absent Today",
      value: stats?.today_absent ?? 0,
      icon: XCircle,
      color: "text-red-600 bg-red-50 border-red-200",
    },
  ];

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className={`p-6 bg-white border rounded-3xl shadow-sm flex items-center gap-4 transition-all hover:scale-[1.01] hover:shadow-md`}
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${card.color}`}>
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-[#64748B] font-bold block">{card.title}</span>
                <span className="text-2xl font-extrabold text-[#1E293B] block mt-0.5">
                  {card.value}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Activity Table */}
      <div className="bg-white border border-[#E2E8F0] rounded-3xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-[#E2E8F0] flex items-center gap-2">
          <Clock className="w-5 h-5 text-[#5B5FEF]" />
          <h2 className="text-lg font-bold text-[#1E293B]">Recent Attendance Activity</h2>
        </div>

        {recentLogs.length === 0 ? (
          <div className="text-center py-16 text-sm text-[#64748B]">No recent logs found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs text-[#64748B]">
              <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] font-bold text-[#1E293B]">
                <tr>
                  <th className="p-4">Time</th>
                  <th className="p-4">Student Name</th>
                  <th className="p-4">Reg No</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Verification Method</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9] font-medium text-[#1E293B]">
                {recentLogs.map((log, idx) => {
                  const timeStr = log.marked_at ? formatDateTime(log.marked_at) : "Overridden Today";

                  let badgeStyle = "bg-red-50 text-red-700 border-red-200";
                  if (log.status === "present") {
                    badgeStyle = "bg-green-50 text-green-700 border-green-200";
                  }

                  let methodStyle = "bg-purple-50 text-purple-700 border-purple-200";
                  if (log.method === "AI") {
                    methodStyle = "bg-blue-50 text-blue-700 border-blue-200";
                  }

                  return (
                    <tr key={idx} className="hover:bg-[#F8FAFC]/50 transition-all">
                      <td className="p-4 text-[#64748B] font-semibold">{timeStr}</td>
                      <td className="p-4 font-bold">{log.student_name}</td>
                      <td className="p-4 font-semibold text-[#64748B]">{log.register_number}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 border text-[10px] font-bold rounded-lg ${badgeStyle}`}>
                          {log.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 border text-[9px] font-bold rounded-md ${methodStyle}`}>
                          {log.method}
                        </span>
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
