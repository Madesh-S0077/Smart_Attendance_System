import { useState, useEffect } from "react";
import { Settings, Wifi, Clock, UserPlus, AlertCircle, Plus, Trash2, CheckCircle, ShieldAlert } from "lucide-react";
import apiClient from "../api/client";
import { ApiResponse } from "../types";

export default function AdminSettings() {
  const [isLoadingSSID, setIsLoadingSSID] = useState(false);
  const [isLoadingSlot, setIsLoadingSlot] = useState(false);
  const [isLoadingRegister, setIsLoadingRegister] = useState(false);

  // SSID Config
  const [ssids, setSsids] = useState<string[]>([]);
  const [newSsidInput, setNewSsidInput] = useState("");

  // Attendance Slot Config
  const [startTime, setStartTime] = useState("08:30");
  const [endTime, setEndTime] = useState("10:00");

  // New Admin Fields
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  // Toast notifications
  const [toastMessage, setToastMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const showToast = (text: string, isError = false) => {
    setToastMessage({ text, isError });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadSettingsData = async () => {
    try {
      // Fetch allowed SSIDs
      const ssidResp = await apiClient.get<ApiResponse<string[]>>("/api/admin/ssid-config");
      if (ssidResp.data.success && ssidResp.data.data) {
        setSsids(ssidResp.data.data);
      }
    } catch (err) {
      console.error("Failed to load settings configuration:", err);
    }
  };

  useEffect(() => {
    loadSettingsData();
  }, []);

  // Section 1: Save SSID Config
  const handleAddSsid = () => {
    if (!newSsidInput.trim()) return;
    if (ssids.includes(newSsidInput.trim())) {
      showToast("SSID already in configuration list.", true);
      return;
    }
    setSsids([...ssids, newSsidInput.trim()]);
    setNewSsidInput("");
  };

  const handleRemoveSsid = (target: string) => {
    setSsids(ssids.filter((s) => s !== target));
  };

  const handleSaveSSIDConfig = async () => {
    setIsLoadingSSID(true);
    try {
      const response = await apiClient.put<ApiResponse<string[]>>("/api/admin/ssid-config", {
        allowed_ssids: ssids,
      });
      if (response.data.success) {
        showToast("SSID configuration saved successfully ✓");
      }
    } catch (err: any) {
      showToast(err.response?.data?.error || "Failed to update SSID configurations.", true);
    } finally {
      setIsLoadingSSID(false);
    }
  };

  // Section 2: Save Slot Window Config
  const handleSaveSlotConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoadingSlot(true);
    try {
      const response = await apiClient.put<ApiResponse<any>>("/api/admin/slot-config", {
        start_time: startTime,
        end_time: endTime,
      });
      if (response.data.success) {
        showToast("Time slot configuration saved successfully ✓");
      }
    } catch (err: any) {
      showToast(err.response?.data?.error || "Failed to save slot configurations.", true);
    } finally {
      setIsLoadingSlot(false);
    }
  };

  // Section 3: Register New Admin
  const handleRegisterAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword.length < 8) {
      showToast("Password must be at least 8 characters.", true);
      return;
    }

    setIsLoadingRegister(true);
    try {
      const response = await apiClient.post<ApiResponse<any>>("/api/auth/register/admin", {
        email: adminEmail,
        password: adminPassword,
        name: adminName,
      });

      if (response.data.success) {
        showToast("Admin account registered successfully ✓");
        setAdminName("");
        setAdminEmail("");
        setAdminPassword("");
      }
    } catch (err: any) {
      showToast(err.response?.data?.error || "Failed to create administrator account.", true);
    } finally {
      setIsLoadingRegister(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto relative">
      {/* Toast popup */}
      {toastMessage && (
        <div
          className={`fixed top-6 right-6 z-50 p-4 rounded-xl border shadow-xl flex items-center gap-2 font-bold text-sm transition-all duration-300 animate-slide-in ${
            toastMessage.isError
              ? "bg-red-50 border-red-200 text-red-600"
              : "bg-green-50 border-green-200 text-green-600"
          }`}
        >
          {toastMessage.isError ? <ShieldAlert className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
          {toastMessage.text}
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-[#1E293B] flex items-center gap-2">
          <Settings className="w-6 h-6 text-[#5B5FEF]" />
          System Settings
        </h1>
        <p className="text-[#64748B] text-sm mt-1">Configure geofencing, timing, and security</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Left Col: Section 1 SSID & Section 2 Window */}
        <div className="space-y-8">
          {/* Section 1: Geofence config */}
          <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-[#1E293B] flex items-center gap-1.5 border-b pb-2">
              <Wifi className="w-5 h-5 text-[#5B5FEF]" />
              Geofence SSID Configurations
            </h2>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. RMKEC_LAB"
                value={newSsidInput}
                onChange={(e) => setNewSsidInput(e.target.value)}
                className="flex-1 px-4 py-2 border border-[#E2E8F0] focus:ring-2 focus:ring-[#5B5FEF] rounded-xl text-xs bg-[#F8FAFC]"
              />
              <button
                onClick={handleAddSsid}
                className="px-3 py-2 bg-gradient-to-r from-[#5B5FEF] to-[#7B7DFF] text-white rounded-xl text-xs font-bold flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>

            {/* List */}
            <div className="space-y-2 max-h-[140px] overflow-y-auto border border-[#E2E8F0] p-3 rounded-xl bg-slate-50">
              {ssids.length === 0 ? (
                <span className="text-xs text-[#64748B] italic block text-center py-4">
                  No SSIDs configured. Default fallback is active.
                </span>
              ) : (
                ssids.map((ssid) => (
                  <div
                    key={ssid}
                    className="flex justify-between items-center bg-white p-2 rounded-lg border border-[#E2E8F0] text-xs font-bold text-[#1E293B]"
                  >
                    <span>{ssid}</span>
                    <button
                      onClick={() => handleRemoveSsid(ssid)}
                      className="text-[#64748B] hover:text-[#EF4444]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 text-[10px] font-semibold flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-blue-500 flex-shrink-0" />
              <span>Note: Changes take effect on next student application restart.</span>
            </div>

            <button
              onClick={handleSaveSSIDConfig}
              disabled={isLoadingSSID}
              className="w-full h-10 bg-[#5B5FEF] hover:bg-[#4B4FEF] text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center disabled:opacity-50"
            >
              {isLoadingSSID ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                "Save SSID Configuration"
              )}
            </button>
          </div>

          {/* Section 2: Attendance Window */}
          <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 shadow-sm">
            <h2 className="text-base font-bold text-[#1E293B] flex items-center gap-1.5 border-b pb-2 mb-4">
              <Clock className="w-5 h-5 text-[#5B5FEF]" />
              Attendance Slot Window
            </h2>

            <form onSubmit={handleSaveSlotConfig} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#1E293B] mb-1">Start Time</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-[#E2E8F0] focus:ring-2 focus:ring-[#5B5FEF] rounded-xl text-xs bg-[#F8FAFC]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#1E293B] mb-1">End Time</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-[#E2E8F0] focus:ring-2 focus:ring-[#5B5FEF] rounded-xl text-xs bg-[#F8FAFC]"
                  />
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 text-[10px] font-semibold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-blue-500 flex-shrink-0" />
                <span>Note: Affects future auto-generated and manually generated slots only.</span>
              </div>

              <button
                type="submit"
                disabled={isLoadingSlot}
                className="w-full h-10 bg-[#5B5FEF] hover:bg-[#4B4FEF] text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center disabled:opacity-50"
              >
                {isLoadingSlot ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  "Save Window configuration"
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Col: Section 3 Register New Admin */}
        <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <h2 className="text-base font-bold text-[#1E293B] flex items-center gap-1.5 border-b pb-2 mb-4">
            <UserPlus className="w-5 h-5 text-[#5B5FEF]" />
            Register Secondary Administrator
          </h2>

          <form onSubmit={handleRegisterAdmin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#1E293B] mb-1">Admin Full Name</label>
              <input
                type="text"
                placeholder="e.g. Admin Name"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                required
                className="w-full px-4 py-2.5 border border-[#E2E8F0] focus:ring-2 focus:ring-[#5B5FEF] rounded-xl text-xs bg-[#F8FAFC]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1E293B] mb-1">Email Address</label>
              <input
                type="email"
                placeholder="admin@rmkec.ac.in"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                required
                className="w-full px-4 py-2.5 border border-[#E2E8F0] focus:ring-2 focus:ring-[#5B5FEF] rounded-xl text-xs bg-[#F8FAFC]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1E293B] mb-1">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                required
                className="w-full px-4 py-2.5 border border-[#E2E8F0] focus:ring-2 focus:ring-[#5B5FEF] rounded-xl text-xs bg-[#F8FAFC]"
              />
            </div>

            <button
              type="submit"
              disabled={isLoadingRegister}
              className="w-full h-11 bg-gradient-to-r from-[#5B5FEF] to-[#7B7DFF] text-white rounded-xl font-bold hover:shadow-lg transition-all active:scale-[0.98] flex items-center justify-center text-xs disabled:opacity-50 mt-6"
            >
              {isLoadingRegister ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                "Enroll New Administrator"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
