import { useState, useEffect } from "react";
import { X, CheckCircle, ShieldAlert } from "lucide-react";
import apiClient from "../../api/client";
import { ApiResponse } from "../../types";
import { useAuthStore } from "../../store/authStore";

interface TeacherProfilePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TeacherProfilePanel({ isOpen, onClose }: TeacherProfilePanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Form Fields
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [position, setPosition] = useState("");
  const [email, setEmail] = useState("");

  // Password Fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const showToast = (text: string, isError = false) => {
    setToastMessage({ text, isError });
    setTimeout(() => setToastMessage(null), 4000);
  };

  useEffect(() => {
    if (!isOpen) return;

    const fetchProfile = async () => {
      try {
        const response = await apiClient.get<ApiResponse<any>>("/api/teachers/me");
        if (response.data.success && response.data.data) {
          const t = response.data.data;
          setName(t.name);
          setDepartment(t.department);
          setPosition(t.position);
          setEmail(t.email);
        }
      } catch (err) {
        console.error("Failed to load teacher profile details:", err);
        showToast("Failed to load profile details.", true);
      }
    };

    fetchProfile();
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleEscape);
    }
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setToastMessage(null);

    // Password validation if they fill any password field
    if (currentPassword || newPassword || confirmPassword) {
      if (!currentPassword) {
        showToast("Current password is required to change password.", true);
        setIsLoading(false);
        return;
      }
      if (newPassword.length < 8) {
        showToast("New password must be at least 8 characters.", true);
        setIsLoading(false);
        return;
      }
      if (newPassword !== confirmPassword) {
        showToast("New passwords do not match.", true);
        setIsLoading(false);
        return;
      }
    }

    try {
      const payload: any = {
        name,
        department,
        position,
      };

      if (newPassword) {
        payload.password = newPassword;
      }

      const response = await apiClient.put<ApiResponse<any>>("/api/teachers/me", payload);

      if (response.data.success) {
        showToast("Profile updated ✓");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        // Update user store
        useAuthStore.setState((state) => ({
          user: state.user ? { ...state.user, name } : null,
        }));
      } else {
        showToast(response.data.error || "Failed to update profile.", true);
      }
    } catch (err: any) {
      showToast(err.response?.data?.error || "Failed to update profile details.", true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 transition-all duration-300"
        ></div>
      )}

      {/* Slide-in Panel */}
      <div
        className={`fixed inset-y-0 right-0 w-full max-w-[440px] bg-white shadow-2xl z-50 transform ${
          isOpen ? "translate-x-0" : "translate-x-full"
        } transition-transform duration-300 ease-in-out border-l border-[#E2E8F0] overflow-y-auto flex flex-col justify-between`}
      >
        {/* Header */}
        <div className="p-6 border-b border-[#E2E8F0] flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-xl font-bold text-[#1E293B]">Profile settings</h2>
            <p className="text-xs text-[#64748B] mt-0.5">Manage your teacher credentials</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg border border-[#E2E8F0] flex items-center justify-center text-[#64748B] hover:text-[#1E293B] active:scale-95 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 flex-1 space-y-6">
          {toastMessage && (
            <div
              className={`p-3 rounded-xl border text-sm font-semibold flex items-center gap-2 ${
                toastMessage.isError
                  ? "bg-red-50 border-red-200 text-red-600"
                  : "bg-green-50 border-green-200 text-green-600"
              }`}
            >
              {toastMessage.isError ? (
                <ShieldAlert className="w-5 h-5 flex-shrink-0" />
              ) : (
                <CheckCircle className="w-5 h-5 flex-shrink-0" />
              )}
              {toastMessage.text}
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <h3 className="text-sm font-bold text-[#1E293B] border-b pb-1">Basic Info</h3>

            {/* Name */}
            <div>
              <label className="block text-xs font-semibold text-[#1E293B] mb-1">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-2 rounded-xl border border-[#E2E8F0] focus:ring-2 focus:ring-[#5B5FEF] bg-[#F8FAFC] text-sm"
              />
            </div>

            {/* Email (Readonly) */}
            <div>
              <label className="block text-xs font-semibold text-[#64748B] mb-1">Email Address (Readonly)</label>
              <input
                type="email"
                value={email}
                disabled
                className="w-full px-4 py-2 rounded-xl border border-[#E2E8F0] bg-[#E2E8F0]/30 text-[#64748B] text-sm cursor-not-allowed"
              />
            </div>

            {/* Department */}
            <div>
              <label className="block text-xs font-semibold text-[#1E293B] mb-1">Department</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                required
                className="w-full px-4 py-2 rounded-xl border border-[#E2E8F0] focus:ring-2 focus:ring-[#5B5FEF] bg-[#F8FAFC] text-sm"
              >
                {["CSE", "ECE", "EEE", "MECH", "CIVIL", "IT", "AIDS", "AIML"].map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            {/* Position */}
            <div>
              <label className="block text-xs font-semibold text-[#1E293B] mb-1">Position</label>
              <select
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                required
                className="w-full px-4 py-2 rounded-xl border border-[#E2E8F0] focus:ring-2 focus:ring-[#5B5FEF] bg-[#F8FAFC] text-sm"
              >
                {["Assistant Professor", "Associate Professor", "Professor", "HOD"].map((pos) => (
                  <option key={pos} value={pos}>
                    {pos}
                  </option>
                ))}
              </select>
            </div>

            {/* Password Change */}
            <h3 className="text-sm font-bold text-[#1E293B] border-b pb-1 pt-4">Change Password</h3>

            <div>
              <label className="block text-xs font-semibold text-[#1E293B] mb-1">Current Password</label>
              <input
                type="password"
                placeholder="Leave blank to keep current"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-[#E2E8F0] focus:ring-2 focus:ring-[#5B5FEF] bg-[#F8FAFC] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1E293B] mb-1">New Password</label>
              <input
                type="password"
                placeholder="Min 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-[#E2E8F0] focus:ring-2 focus:ring-[#5B5FEF] bg-[#F8FAFC] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1E293B] mb-1">Confirm New Password</label>
              <input
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-[#E2E8F0] focus:ring-2 focus:ring-[#5B5FEF] bg-[#F8FAFC] text-sm"
              />
            </div>

            {/* Save Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 bg-gradient-to-r from-[#5B5FEF] to-[#7B7DFF] text-white rounded-xl font-semibold hover:opacity-95 shadow-md active:scale-[0.98] transition-all flex items-center justify-center text-sm disabled:opacity-50 mt-6"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                "Save Profile Updates"
              )}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
