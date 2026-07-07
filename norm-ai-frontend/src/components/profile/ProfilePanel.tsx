import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { X, Camera, RefreshCw, CheckCircle, ShieldAlert } from "lucide-react";
import apiClient from "../../api/client";
import { ApiResponse } from "../../types";
import { useAuthStore } from "../../store/authStore";

interface ProfilePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TeacherItem {
  id: string;
  name: string;
  department: string;
}

type PhotoState = "IDLE" | "CAPTURING" | "REVIEW" | "PROCESSING" | "DONE";

export default function ProfilePanel({ isOpen, onClose }: ProfilePanelProps) {
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Form Fields
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [section, setSection] = useState("");
  const [counsellorId, setCounsellorId] = useState("");
  const [counsellorName, setCounsellorName] = useState("");
  const [email, setEmail] = useState("");
  const [registerNumber, setRegisterNumber] = useState("");

  // Password Fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Camera Face Capture State Machine
  const [photoState, setPhotoState] = useState<PhotoState>("IDLE");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Trigger Toast Notification
  const showToast = (text: string, isError = false) => {
    setToastMessage({ text, isError });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Fetch student profile details & teachers
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      try {
        // Fetch teachers list
        const teachersResp = await apiClient.get<ApiResponse<TeacherItem[]>>("/api/teachers/");
        if (teachersResp.data.success && teachersResp.data.data) {
          setTeachers(teachersResp.data.data);
        }

        // Fetch student details
        const studentResp = await apiClient.get<ApiResponse<any>>("/api/students/me");
        if (studentResp.data.success && studentResp.data.data) {
          const s = studentResp.data.data;
          setName(s.name);
          setDepartment(s.department);
          setSection(s.section);
          setCounsellorId(s.counsellor_id || "");
          setCounsellorName(s.counsellor_name || "Not Assigned");
          setEmail(s.email);
          setRegisterNumber(s.register_number);
        }
      } catch (err) {
        console.error("Failed to load profile panel data:", err);
        showToast("Failed to load profile details.", true);
      }
    };

    loadData();
  }, [isOpen]);

  // Escape key listener to close drawer
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        stopCamera();
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

  // Start Camera Stream
  const startCamera = async () => {
    setCameraError(null);
    setPhotoState("CAPTURING");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
      });
      streamRef.current = stream;
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err) {
      setCameraError("Camera access denied.");
      setPhotoState("IDLE");
    }
  };

  // Stop Camera Stream
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  // Capture Frame
  const captureFrame = () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.translate(640, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(videoRef.current, 0, 0, 640, 480);
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        const dataUrl = canvas.toDataURL("image/jpeg");
        setPhotoDataUrl(dataUrl);
        setPhotoState("REVIEW");
        stopCamera();
      }
    }
  };

  const retakePhoto = () => {
    setPhotoDataUrl(null);
    startCamera();
  };

  // Process Capture with local sidecar and upload
  const uploadNewPhoto = async () => {
    if (!photoDataUrl) return;
    setPhotoState("PROCESSING");
    setCameraError(null);

    const base64Data = photoDataUrl.split(",")[1];

    try {
      // Analyze with sidecar
      const response = await axios.post<{
        faces_detected: number;
        is_live: boolean;
        embedding: number[] | null;
        error: string | null;
      }>("http://127.0.0.1:8765/analyze", {
        image_base64: base64Data,
      }, {
        timeout: 30000
      });

      const res = response.data;
      if (res.error) {
        setCameraError(res.error);
        setPhotoState("CAPTURING");
        startCamera();
        return;
      }

      if (!res.is_live) {
        setCameraError("Liveness check failed. Use a real face in good lighting.");
        setPhotoState("CAPTURING");
        startCamera();
        return;
      }

      if (res.embedding && res.embedding.length === 512) {
        // Upload embedding via PUT /api/students/me
        const uploadResp = await apiClient.put<ApiResponse<any>>("/api/students/me", {
          face_embedding: res.embedding,
        });

        if (uploadResp.data.success) {
          setPhotoState("DONE");
          showToast("Profile photo updated ✓");
          setTimeout(() => setPhotoState("IDLE"), 2000);
        } else {
          setCameraError(uploadResp.data.error || "Failed to update profile vector.");
          setPhotoState("CAPTURING");
          startCamera();
        }
      }
    } catch (err) {
      setCameraError("AI sidecar connection failed. Ensure sidecar is active.");
      setPhotoState("CAPTURING");
      startCamera();
    }
  };

  // Submit Profile Info Changes
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
        section,
        counsellor_id: counsellorId,
      };

      if (newPassword) {
        payload.password = newPassword;
      }

      const response = await apiClient.put<ApiResponse<any>>("/api/students/me", payload);

      if (response.data.success) {
        showToast("Profile updated ✓");
        // Clear passwords fields
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
          onClick={() => {
            stopCamera();
            onClose();
          }}
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
            <p className="text-xs text-[#64748B] mt-0.5">Manage your student credentials</p>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="w-8 h-8 rounded-lg border border-[#E2E8F0] flex items-center justify-center text-[#64748B] hover:text-[#1E293B] active:scale-95 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 flex-1 space-y-8">
          {/* Toast message display inside panel */}
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

          {/* ── Photo Capture / Update Section ──────────────────────────────── */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-4 flex flex-col items-center">
            {photoState === "IDLE" && (
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 bg-gradient-to-tr from-[#5B5FEF] to-[#7B7DFF] rounded-2xl flex items-center justify-center text-white text-2xl font-extrabold shadow-md mb-3 relative overflow-hidden group">
                  {name
                    ? name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)
                    : "ST"}
                </div>
                <button
                  type="button"
                  onClick={startCamera}
                  className="text-xs text-[#5B5FEF] font-bold hover:underline flex items-center gap-1"
                >
                  <Camera className="w-3.5 h-3.5" />
                  Update Photo Profile
                </button>
              </div>
            )}

            {photoState === "CAPTURING" && (
              <div className="relative aspect-[4/3] w-full bg-[#1E293B] rounded-xl overflow-hidden shadow-inner flex flex-col justify-end">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
                />
                {/* Square overlay Face Alignment */}
                <div className="absolute inset-0 border-[36px] border-[#1E293B]/70 flex items-center justify-center pointer-events-none">
                  <div className="w-[150px] h-[150px] border-2 border-dashed border-[#5B5FEF] rounded-2xl"></div>
                </div>
                <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2 z-10">
                  <button
                    type="button"
                    onClick={() => {
                      stopCamera();
                      setPhotoState("IDLE");
                    }}
                    className="px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={captureFrame}
                    className="px-3.5 py-1 bg-[#5B5FEF] text-white text-xs font-semibold rounded hover:shadow-lg"
                  >
                    Capture
                  </button>
                </div>
              </div>
            )}

            {photoState === "REVIEW" && photoDataUrl && (
              <div className="relative aspect-[4/3] w-full bg-[#1E293B] rounded-xl overflow-hidden flex flex-col justify-end">
                <img src={photoDataUrl} className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2 z-10">
                  <button
                    type="button"
                    onClick={retakePhoto}
                    className="px-2.5 py-1 bg-white/30 hover:bg-white/40 text-white text-xs font-semibold rounded"
                  >
                    Retake
                  </button>
                  <button
                    type="button"
                    onClick={uploadNewPhoto}
                    className="px-3.5 py-1 bg-[#5B5FEF] text-white text-xs font-semibold rounded hover:shadow-lg"
                  >
                    Accept & Upload
                  </button>
                </div>
              </div>
            )}

            {photoState === "PROCESSING" && (
              <div className="w-full flex flex-col items-center justify-center py-6">
                <RefreshCw className="w-8 h-8 text-[#5B5FEF] animate-spin mb-2" />
                <span className="text-xs font-semibold text-[#1E293B]">Analyzing liveness...</span>
              </div>
            )}

            {photoState === "DONE" && (
              <div className="w-full flex flex-col items-center justify-center py-6 text-[#22C55E]">
                <CheckCircle className="w-8 h-8 mb-2 animate-bounce" />
                <span className="text-xs font-bold">Face updated successfully ✓</span>
              </div>
            )}

            {cameraError && (
              <div className="mt-2 text-xs text-[#EF4444] font-semibold text-center">{cameraError}</div>
            )}
          </div>

          {/* Form */}
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

            {/* Register Number (Readonly) */}
            <div>
              <label className="block text-xs font-semibold text-[#64748B] mb-1">Register Number (Readonly)</label>
              <input
                type="text"
                value={registerNumber}
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

            {/* Section */}
            <div>
              <label className="block text-xs font-semibold text-[#1E293B] mb-1">Section</label>
              <select
                value={section}
                onChange={(e) => setSection(e.target.value)}
                required
                className="w-full px-4 py-2 rounded-xl border border-[#E2E8F0] focus:ring-2 focus:ring-[#5B5FEF] bg-[#F8FAFC] text-sm"
              >
                {["A", "B", "C", "D"].map((sec) => (
                  <option key={sec} value={sec}>
                    {sec}
                  </option>
                ))}
              </select>
            </div>

            {/* Counsellor */}
            <div>
              <label className="block text-xs font-semibold text-[#1E293B] mb-1">Counsellor</label>
              <select
                value={counsellorId}
                onChange={(e) => setCounsellorId(e.target.value)}
                required
                className="w-full px-4 py-2 rounded-xl border border-[#E2E8F0] focus:ring-2 focus:ring-[#5B5FEF] bg-[#F8FAFC] text-sm"
              >
                <option value="">Select Counsellor</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} — {t.department}
                  </option>
                ))}
              </select>
            </div>

            {/* ── Password Change Section ────────────────────────────────────── */}
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

            {/* ── Academic Info (Readonly) ───────────────────────────────────── */}
            <h3 className="text-sm font-bold text-[#1E293B] border-b pb-1 pt-4">Academic Info</h3>
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl text-xs">
              <div>
                <span className="block text-[#64748B] font-semibold">Year of Study:</span>
                <span className="font-bold text-[#1E293B]">2nd Year</span>
              </div>
              <div>
                <span className="block text-[#64748B] font-semibold">Counsellor Name:</span>
                <span className="font-bold text-[#1E293B] truncate block">{counsellorName}</span>
              </div>
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
