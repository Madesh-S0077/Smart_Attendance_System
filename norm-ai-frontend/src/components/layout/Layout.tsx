import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  CalendarDays,
  UserCircle,
  LogOut,
  Bell,
} from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import ProfilePanel from "../profile/ProfilePanel";
import apiClient from "../../api/client";
import { ApiResponse } from "../../types";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, clearAuth } = useAuthStore();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [studentDetails, setStudentDetails] = useState<{
    department: string;
    section: string;
  } | null>(null);

  // Fetch student profile details for header info
  useEffect(() => {
    const fetchStudentProfile = async () => {
      try {
        const response = await apiClient.get<ApiResponse<any>>("/api/students/me");
        if (response.data.success && response.data.data) {
          setStudentDetails({
            department: response.data.data.department,
            section: response.data.data.section,
          });
          // Update username in authStore if it was a default placeholder
          useAuthStore.setState((state) => ({
            user: state.user ? { ...state.user, name: response.data.data.name } : null,
          }));
        }
      } catch (err) {
        console.error("Failed to fetch student details in layout:", err);
      }
    };

    if (user?.role === "student") {
      fetchStudentProfile();
    }
  }, [user?.role]);

  const handleLogout = async () => {
    if (window.confirm("Are you sure you want to sign out?")) {
      await clearAuth();
      navigate("/login");
    }
  };

  const navItems = [
    {
      name: "Dashboard",
      path: "/student",
      icon: LayoutDashboard,
    },
    {
      name: "Attendance History",
      path: "/student/history",
      icon: CalendarDays,
    },
    {
      name: "Profile",
      path: "#profile",
      icon: UserCircle,
      onClick: () => setIsProfileOpen(true),
    },
  ];

  const currentDateString = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "ST";

  return (
    <div className="min-h-screen bg-[#F7F8FC] flex relative overflow-hidden">
      {/* ── Left Sidebar (Fixed 240px) ────────────────────────────────────────── */}
      <aside className="w-[240px] bg-white border-r border-[#E2E8F0] flex flex-col justify-between fixed top-0 bottom-0 left-0 z-30">
        <div>
          {/* Logo */}
          <div className="py-6 px-6 flex items-center gap-3 border-b border-[#F1F5F9]">
            <div className="w-10 h-10 bg-[#5B5FEF]/10 rounded-xl flex items-center justify-center text-[#5B5FEF]">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-xl font-extrabold bg-gradient-to-r from-[#5B5FEF] to-[#7B7DFF] bg-clip-text text-transparent">
              Norm AI
            </span>
          </div>

          {/* Nav Items */}
          <nav className="p-4 space-y-2 mt-6">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <button
                  key={item.name}
                  onClick={item.onClick ? item.onClick : () => navigate(item.path)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition-all ${
                    isActive
                      ? "bg-gradient-to-r from-[#5B5FEF] to-[#7B7DFF] text-white shadow-md shadow-[#5B5FEF]/15"
                      : "text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#1E293B]"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.name}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Logout Button */}
        <div className="p-4 border-t border-[#F1F5F9]">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-[#64748B] rounded-xl hover:bg-[#FEE2E2] hover:text-[#EF4444] transition-all"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </aside>

      {/* ── Main Content Area ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col pl-[240px]">
        {/* Sticky Header */}
        <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-[#E2E8F0] h-20 px-8 flex items-center justify-between z-20">
          {/* Greeting */}
          <div>
            <h2 className="text-lg font-bold text-[#1E293B] flex items-center gap-1.5">
              {getGreeting()}, {user?.name || "Student"} 👋
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              {studentDetails
                ? `2nd Year ${studentDetails.department} — Section ${studentDetails.section}`
                : "2nd Year CSE — Section A"}
            </p>
          </div>

          {/* Right Header Badges */}
          <div className="flex items-center gap-4">
            {/* Date Badge */}
            <div className="hidden md:flex px-3 py-1.5 bg-[#F1F5F9] rounded-xl text-xs font-semibold text-[#64748B]">
              {currentDateString}
            </div>

            {/* Notification Bell */}
            <button className="w-10 h-10 rounded-xl border border-[#E2E8F0] flex items-center justify-center text-[#64748B] hover:bg-[#F8FAFC] transition-all relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2.5 w-2 h-2 bg-[#EF4444] rounded-full"></span>
            </button>

            {/* Profile Avatar Trigger */}
            <button
              onClick={() => setIsProfileOpen(true)}
              className="w-10 h-10 rounded-xl bg-gradient-to-r from-[#5B5FEF] to-[#7B7DFF] text-white font-bold text-sm flex items-center justify-center shadow-md active:scale-95 transition-all"
            >
              {initials}
            </button>
          </div>
        </header>

        {/* Content Body */}
        <main className="p-8 flex-1 min-h-[calc(100-5rem)] animate-fade-in">
          {children}
        </main>
      </div>

      {/* Slide-in Profile Sidebar Panel */}
      <ProfilePanel isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </div>
  );
}
