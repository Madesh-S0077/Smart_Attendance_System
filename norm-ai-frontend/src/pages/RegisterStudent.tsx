import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import * as z from "zod";
import apiClient from "../api/client";
import { ApiResponse } from "../types";

const studentSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters").max(255).trim(),
    register_number: z
      .string()
      .min(5, "Register number must be at least 5 characters")
      .max(20)
      .toUpperCase(),
    department: z.string().min(1, "Please select a department"),
    section: z.string().min(1, "Please select a section"),
    counsellor_id: z.string().min(1, "Please select a counsellor"),
    email: z.string().email("Please enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters").max(128),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type StudentFormData = z.infer<typeof studentSchema>;

const departments = ["CSE", "ECE", "EEE", "MECH", "CIVIL", "IT", "AIDS", "AIML"];
const sections = ["A", "B", "C", "D"];

type CameraState = "IDLE" | "CAPTURING" | "REVIEW" | "PROCESSING" | "DONE";

interface TeacherDropdownItem {
  id: string;
  name: string;
  department: string;
}

export default function RegisterStudent() {
  const navigate = useNavigate();
  const [teachers, setTeachers] = useState<TeacherDropdownItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Success Redirect Modal
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [countdown, setCountdown] = useState(3);

  // Camera & Face Capture State Machine
  const [cameraState, setCameraState] = useState<CameraState>("IDLE");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [faceEmbedding, setFaceEmbedding] = useState<number[] | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid },
  } = useForm<StudentFormData>({
    resolver: zodResolver(studentSchema),
    mode: "onChange",
  });

  const passwordField = watch("password");
  const [passValue, setPassValue] = useState("");

  useEffect(() => {
    setPassValue(passwordField || "");
  }, [passwordField]);

  // Fetch teachers for counsellor select
  useEffect(() => {
    const fetchTeachers = async () => {
      try {
        const response = await apiClient.get<ApiResponse<TeacherDropdownItem[]>>("/api/teachers/");
        if (response.data.success && response.data.data) {
          setTeachers(response.data.data);
        }
      } catch (err) {
        console.error("Failed to load counsellors dropdown:", err);
      }
    };
    fetchTeachers();
  }, []);

  // Handle countdown on success redirect
  useEffect(() => {
    if (showSuccessModal && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (showSuccessModal && countdown === 0) {
      navigate("/login");
    }
  }, [showSuccessModal, countdown, navigate]);

  const getPasswordStrength = (pass: string) => {
    if (!pass) return { label: "None", color: "bg-[#E2E8F0]", width: "w-0" };
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;

    if (score <= 1) return { label: "Weak", color: "bg-[#EF4444]", width: "w-1/4" };
    if (score <= 3) return { label: "Medium", color: "bg-[#F59E0B]", width: "w-2/4" };
    return { label: "Strong", color: "bg-[#22C55E]", width: "w-full" };
  };

  const strength = getPasswordStrength(passValue);

  // Start Video Stream
  const startCamera = async () => {
    setCameraError(null);
    setCameraState("CAPTURING");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      setCameraError("Could not access camera. Please check permissions.");
      setCameraState("IDLE");
    }
  };

  // Stop Video Stream
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  // Capture Frame
  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Flip image horizontally for natural mirroring
        ctx.translate(640, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(videoRef.current, 0, 0, 640, 480);
        // Reset transform
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        const dataUrl = canvas.toDataURL("image/jpeg");
        setPhotoDataUrl(dataUrl);
        setCameraState("REVIEW");
        stopCamera();
      }
    }
  };

  // Process Captured Face with Sidecar
  const acceptPhoto = async () => {
    if (!photoDataUrl) return;
    setCameraState("PROCESSING");
    setCameraError(null);

    // Strip header prefix
    const base64Data = photoDataUrl.split(",")[1];

    try {
      const response = await axios.post<{
        faces_detected: number;
        is_live: boolean;
        liveness_score: number;
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
        setCameraState("CAPTURING");
        startCamera();
        return;
      }

      if (!res.is_live) {
        setCameraError("Liveness check failed. Please capture in good lighting.");
        setCameraState("CAPTURING");
        startCamera();
        return;
      }

      if (res.embedding && res.embedding.length === 512) {
        setFaceEmbedding(res.embedding);
        setCameraState("DONE");
      } else {
        setCameraError("Could not extract face data. Try again.");
        setCameraState("CAPTURING");
        startCamera();
      }
    } catch (err) {
      setCameraError("Failed to connect to local AI sidecar. Ensure it is running.");
      setCameraState("CAPTURING");
      startCamera();
    }
  };

  const retakePhoto = () => {
    setPhotoDataUrl(null);
    setFaceEmbedding(null);
    startCamera();
  };

  const onSubmit = async (data: StudentFormData) => {
    if (!faceEmbedding) {
      setApiError("Please capture your face before registering.");
      return;
    }

    setIsLoading(true);
    setApiError(null);

    try {
      const response = await apiClient.post<ApiResponse<any>>("/api/auth/register/student", {
        email: data.email,
        password: data.password,
        name: data.name,
        register_number: data.register_number,
        department: data.department,
        section: data.section,
        counsellor_id: data.counsellor_id,
        face_embedding: faceEmbedding,
      });

      if (response.data.success) {
        setShowSuccessModal(true);
      } else {
        setApiError(response.data.error || "Registration failed");
      }
    } catch (err: any) {
      if (err.response?.data?.error) {
        setApiError(err.response.data.error);
      } else {
        setApiError("Failed to register. Please check database connection.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (window.confirm("Cancel registration? Your progress will be lost.")) {
      stopCamera();
      navigate("/login");
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F7F8FC] flex items-center justify-center p-6 relative">
      {/* Top right close button */}
      <button
        onClick={handleClose}
        className="absolute top-6 right-6 w-10 h-10 bg-white rounded-full border border-[#E2E8F0] flex items-center justify-center text-[#64748B] hover:text-[#1E293B] hover:shadow-md active:scale-95 transition-all z-10"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div className="w-full max-w-[860px] bg-white rounded-3xl shadow-xl p-8 border border-[#E2E8F0] flex flex-col md:flex-row gap-8">
        {/* Left Column: Register Form */}
        <div className="flex-1 space-y-6">
          <div>
            <h1 className="text-2xl font-extrabold text-[#1E293B]">Student Registration</h1>
            <p className="text-[#64748B] text-sm mt-1">Enroll your profile to sign in</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-semibold text-[#1E293B] mb-1">
                Full Name<span className="text-[#EF4444] ml-0.5">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Aditya Kumar"
                {...register("name")}
                className={`w-full px-4 py-2 rounded-xl border ${
                  errors.name ? "border-[#EF4444]" : "border-[#E2E8F0]"
                } focus:outline-none focus:ring-2 focus:ring-[#5B5FEF] bg-[#F8FAFC] text-sm`}
              />
              {errors.name && (
                <span className="text-[#EF4444] text-xs mt-1 block">{errors.name.message}</span>
              )}
            </div>

            <div className="flex gap-4">
              {/* Register Number */}
              <div className="flex-1">
                <label className="block text-xs font-semibold text-[#1E293B] mb-1">
                  Register Number<span className="text-[#EF4444] ml-0.5">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 111422104001"
                  {...register("register_number")}
                  className={`w-full px-4 py-2 rounded-xl border ${
                    errors.register_number ? "border-[#EF4444]" : "border-[#E2E8F0]"
                  } focus:outline-none focus:ring-2 focus:ring-[#5B5FEF] bg-[#F8FAFC] text-sm`}
                />
                {errors.register_number && (
                  <span className="text-[#EF4444] text-xs mt-1 block">
                    {errors.register_number.message}
                  </span>
                )}
              </div>

              {/* Section */}
              <div className="w-24">
                <label className="block text-xs font-semibold text-[#1E293B] mb-1">
                  Section<span className="text-[#EF4444] ml-0.5">*</span>
                </label>
                <select
                  {...register("section")}
                  className={`w-full px-3 py-2 rounded-xl border ${
                    errors.section ? "border-[#EF4444]" : "border-[#E2E8F0]"
                  } focus:outline-none focus:ring-2 focus:ring-[#5B5FEF] bg-[#F8FAFC] text-sm`}
                >
                  <option value="">Select</option>
                  {sections.map((sec) => (
                    <option key={sec} value={sec}>
                      {sec}
                    </option>
                  ))}
                </select>
                {errors.section && (
                  <span className="text-[#EF4444] text-xs mt-1 block">{errors.section.message}</span>
                )}
              </div>
            </div>

            <div className="flex gap-4">
              {/* Department */}
              <div className="flex-1">
                <label className="block text-xs font-semibold text-[#1E293B] mb-1">
                  Department<span className="text-[#EF4444] ml-0.5">*</span>
                </label>
                <select
                  {...register("department")}
                  className={`w-full px-4 py-2 rounded-xl border ${
                    errors.department ? "border-[#EF4444]" : "border-[#E2E8F0]"
                  } focus:outline-none focus:ring-2 focus:ring-[#5B5FEF] bg-[#F8FAFC] text-sm`}
                >
                  <option value="">Select Department</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
                {errors.department && (
                  <span className="text-[#EF4444] text-xs mt-1 block">{errors.department.message}</span>
                )}
              </div>

              {/* Counsellor */}
              <div className="flex-1">
                <label className="block text-xs font-semibold text-[#1E293B] mb-1">
                  Counsellor<span className="text-[#EF4444] ml-0.5">*</span>
                </label>
                <select
                  {...register("counsellor_id")}
                  className={`w-full px-4 py-2 rounded-xl border ${
                    errors.counsellor_id ? "border-[#EF4444]" : "border-[#E2E8F0]"
                  } focus:outline-none focus:ring-2 focus:ring-[#5B5FEF] bg-[#F8FAFC] text-sm`}
                >
                  <option value="">Select Counsellor</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} — {t.department}
                    </option>
                  ))}
                </select>
                {errors.counsellor_id && (
                  <span className="text-[#EF4444] text-xs mt-1 block">
                    {errors.counsellor_id.message}
                  </span>
                )}
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-[#1E293B] mb-1">
                Email Address<span className="text-[#EF4444] ml-0.5">*</span>
              </label>
              <input
                type="email"
                placeholder="you@rmkec.ac.in"
                {...register("email")}
                className={`w-full px-4 py-2 rounded-xl border ${
                  errors.email ? "border-[#EF4444]" : "border-[#E2E8F0]"
                } focus:outline-none focus:ring-2 focus:ring-[#5B5FEF] bg-[#F8FAFC] text-sm`}
              />
              {errors.email && (
                <span className="text-[#EF4444] text-xs mt-1 block">{errors.email.message}</span>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-[#1E293B] mb-1">
                Password<span className="text-[#EF4444] ml-0.5">*</span>
              </label>
              <input
                type="password"
                placeholder="••••••••"
                {...register("password")}
                className={`w-full px-4 py-2 rounded-xl border ${
                  errors.password ? "border-[#EF4444]" : "border-[#E2E8F0]"
                } focus:outline-none focus:ring-2 focus:ring-[#5B5FEF] bg-[#F8FAFC] text-sm`}
              />
              {errors.password && (
                <span className="text-[#EF4444] text-xs mt-1 block">{errors.password.message}</span>
              )}

              {/* Strength Indicator */}
              {passValue && (
                <div className="mt-2">
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="text-[#64748B]">Password Strength:</span>
                    <span className="font-semibold text-xs">{strength.label}</span>
                  </div>
                  <div className="h-1.5 w-full bg-[#E2E8F0] rounded-full overflow-hidden">
                    <div className={`h-full ${strength.color} ${strength.width} transition-all duration-300`}></div>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-semibold text-[#1E293B] mb-1">
                Confirm Password<span className="text-[#EF4444] ml-0.5">*</span>
              </label>
              <input
                type="password"
                placeholder="••••••••"
                {...register("confirmPassword")}
                className={`w-full px-4 py-2 rounded-xl border ${
                  errors.confirmPassword ? "border-[#EF4444]" : "border-[#E2E8F0]"
                } focus:outline-none focus:ring-2 focus:ring-[#5B5FEF] bg-[#F8FAFC] text-sm`}
              />
              {errors.confirmPassword && (
                <span className="text-[#EF4444] text-xs mt-1 block">
                  {errors.confirmPassword.message}
                </span>
              )}
            </div>

            {apiError && (
              <div className="p-3 bg-[#FEE2E2] border border-[#EF4444] rounded-xl text-[#EF4444] text-xs font-semibold">
                {apiError}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !isValid || !faceEmbedding}
              className="w-full h-11 bg-gradient-to-r from-[#5B5FEF] to-[#7B7DFF] text-white rounded-xl font-semibold hover:opacity-95 shadow-md active:scale-[0.98] transition-all flex items-center justify-center text-sm disabled:opacity-50 disabled:pointer-events-none"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                "Complete Enrollment"
              )}
            </button>
          </form>
        </div>

        {/* Right Column: Photo Capture State Machine */}
        <div className="w-full md:w-[360px] flex flex-col justify-between border-t md:border-t-0 md:border-l border-[#E2E8F0] pt-6 md:pt-0 md:pl-8">
          <div className="flex-1 flex flex-col justify-center">
            <h2 className="text-lg font-bold text-[#1E293B] mb-1">Face Profile</h2>
            <p className="text-[#64748B] text-xs mb-4">Required to register. Used for verification.</p>

            {/* State Panels */}
            {cameraState === "IDLE" && (
              <div className="flex-1 flex flex-col items-center justify-center bg-[#F8FAFC] rounded-2xl p-6 border-2 border-dashed border-[#E2E8F0]">
                <div className="w-16 h-16 bg-[#5B5FEF]/10 rounded-2xl flex items-center justify-center mb-4 text-[#5B5FEF]">
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-[#1E293B] mb-1">Capture Your Face</h3>
                <p className="text-[#64748B] text-center text-xs mb-4 max-w-[200px]">
                  Your photo will be used for attendance verification
                </p>
                <button
                  type="button"
                  onClick={startCamera}
                  className="px-4 py-2 bg-[#5B5FEF] text-white text-xs font-semibold rounded-xl hover:shadow-md transition-all flex items-center gap-1.5 active:scale-95"
                >
                  Open Camera
                </button>
              </div>
            )}

            {cameraState === "CAPTURING" && (
              <div className="relative aspect-[4/3] w-full bg-[#1E293B] rounded-2xl overflow-hidden shadow-inner flex flex-col justify-between">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
                />

                {/* Face Guide Overlay */}
                <div className="absolute inset-0 border-[32px] border-[#1E293B]/70 flex items-center justify-center pointer-events-none">
                  <div className="w-[180px] h-[220px] border-2 border-dashed border-[#5B5FEF] rounded-[40px] shadow-[0_0_0_9999px_rgba(30,41,59,0.5)]"></div>
                </div>

                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3 px-4">
                  <button
                    type="button"
                    onClick={() => {
                      stopCamera();
                      setCameraState("IDLE");
                    }}
                    className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold rounded-lg transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={capturePhoto}
                    className="px-4 py-1.5 bg-[#5B5FEF] text-white text-xs font-semibold rounded-lg hover:shadow-lg transition-all"
                  >
                    Capture
                  </button>
                </div>
              </div>
            )}

            {cameraState === "REVIEW" && photoDataUrl && (
              <div className="relative aspect-[4/3] w-full bg-[#1E293B] rounded-2xl overflow-hidden shadow-md flex flex-col justify-end">
                <img src={photoDataUrl} className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3 px-4 z-10">
                  <button
                    type="button"
                    onClick={retakePhoto}
                    className="px-3 py-1.5 bg-white/30 hover:bg-white/40 text-white text-xs font-semibold rounded-lg transition-all"
                  >
                    Retake
                  </button>
                  <button
                    type="button"
                    onClick={acceptPhoto}
                    className="px-4 py-1.5 bg-[#5B5FEF] text-white text-xs font-semibold rounded-lg hover:shadow-lg transition-all"
                  >
                    Accept
                  </button>
                </div>
              </div>
            )}

            {cameraState === "PROCESSING" && (
              <div className="flex-1 flex flex-col items-center justify-center bg-[#F8FAFC] rounded-2xl p-6 border border-[#E2E8F0]">
                <div className="w-10 h-10 border-3 border-[#5B5FEF] border-t-transparent rounded-full animate-spin mb-4"></div>
                <h3 className="text-sm font-bold text-[#1E293B]">Extracting face data...</h3>
                <p className="text-[#64748B] text-xs mt-1">Calling local liveness sidecar...</p>
              </div>
            )}

            {cameraState === "DONE" && (
              <div className="flex-1 flex flex-col items-center justify-center bg-[#F8FAFC] rounded-2xl p-6 border-2 border-[#22C55E]/30 text-center">
                <div className="w-16 h-16 bg-[#22C55E]/10 rounded-2xl flex items-center justify-center mb-4 text-[#22C55E]">
                  <svg className="w-10 h-10 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-[#22C55E] mb-1">Face captured successfully ✓</h3>
                <p className="text-[#64748B] text-xs mb-4">512-dim embedding extracted and validated.</p>
                <button
                  type="button"
                  onClick={retakePhoto}
                  className="px-3 py-1.5 bg-[#64748B]/10 hover:bg-[#64748B]/20 text-[#64748B] text-xs font-semibold rounded-lg transition-all"
                >
                  Retake Photo
                </button>
              </div>
            )}

            {/* Camera Section Error Message */}
            {cameraError && (
              <div className="mt-4 p-3 bg-[#FEE2E2] border border-[#EF4444] rounded-xl text-[#EF4444] text-xs">
                {cameraError}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-[#1E293B]/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-[380px] w-full text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-[#22C55E]/10 rounded-full flex items-center justify-center mb-6">
              <svg className="w-10 h-10 text-[#22C55E] animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-extrabold text-[#1E293B] mb-2">Registration Completed!</h2>
            <p className="text-[#64748B] text-sm mb-6">
              You can now sign in with your credentials.
            </p>
            <div className="text-xs text-[#64748B]">
              Redirecting to login in <span className="font-bold text-[#5B5FEF]">{countdown}</span> seconds...
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
