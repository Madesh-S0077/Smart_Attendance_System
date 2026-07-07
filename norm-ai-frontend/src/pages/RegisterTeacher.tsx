import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import apiClient from "../api/client";
import { ApiResponse } from "../types";

const teacherSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters").max(255).trim(),
    department: z.string().min(1, "Please select a department"),
    position: z.string().min(1, "Please select or type a position"),
    email: z.string().email("Please enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters").max(128),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type TeacherFormData = z.infer<typeof teacherSchema>;

const departments = ["CSE", "ECE", "EEE", "MECH", "CIVIL", "IT", "AIDS", "AIML"];
const positions = ["Assistant Professor", "Associate Professor", "Professor", "HOD"];

export default function RegisterTeacher() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [passValue, setPassValue] = useState("");

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<TeacherFormData>({
    resolver: zodResolver(teacherSchema),
  });

  const passwordField = watch("password");

  useEffect(() => {
    setPassValue(passwordField || "");
  }, [passwordField]);

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
    if (!pass) return { label: "None", color: "bg-[#E2E8F0] text-[#64748B]", width: "w-0" };
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

  const onSubmit = async (data: TeacherFormData) => {
    setIsLoading(true);
    setApiError(null);
    try {
      const response = await apiClient.post<ApiResponse<any>>("/api/auth/register/teacher", {
        email: data.email,
        password: data.password,
        name: data.name,
        department: data.department,
        position: data.position,
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
      navigate("/login");
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F7F8FC] flex items-center justify-center p-6 relative">
      {/* Top right cancel X */}
      <button
        onClick={handleClose}
        className="absolute top-6 right-6 w-10 h-10 bg-white rounded-full border border-[#E2E8F0] flex items-center justify-center text-[#64748B] hover:text-[#1E293B] hover:shadow-md active:scale-95 transition-all"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div className="w-full max-w-[480px] bg-white rounded-3xl shadow-xl p-10 border border-[#E2E8F0]">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-extrabold text-[#1E293B]">Teacher Registration</h1>
          <p className="text-[#64748B] text-sm mt-1">Register to manage classes and students</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Full Name */}
          <div>
            <label className="block text-sm font-semibold text-[#1E293B] mb-1">
              Full Name<span className="text-[#EF4444] ml-0.5">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Dr. Srinivasan R"
              {...register("name")}
              className={`w-full px-4 py-2.5 rounded-xl border ${
                errors.name ? "border-[#EF4444]" : "border-[#E2E8F0]"
              } focus:outline-none focus:ring-2 focus:ring-[#5B5FEF] bg-[#F8FAFC] text-sm transition-all`}
            />
            {errors.name && (
              <span className="text-[#EF4444] text-xs mt-1 block">{errors.name.message}</span>
            )}
          </div>

          {/* Department */}
          <div>
            <label className="block text-sm font-semibold text-[#1E293B] mb-1">
              Department<span className="text-[#EF4444] ml-0.5">*</span>
            </label>
            <select
              {...register("department")}
              className={`w-full px-4 py-2.5 rounded-xl border ${
                errors.department ? "border-[#EF4444]" : "border-[#E2E8F0]"
              } focus:outline-none focus:ring-2 focus:ring-[#5B5FEF] bg-[#F8FAFC] text-sm transition-all`}
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

          {/* Position */}
          <div>
            <label className="block text-sm font-semibold text-[#1E293B] mb-1">
              Position<span className="text-[#EF4444] ml-0.5">*</span>
            </label>
            <select
              {...register("position")}
              className={`w-full px-4 py-2.5 rounded-xl border ${
                errors.position ? "border-[#EF4444]" : "border-[#E2E8F0]"
              } focus:outline-none focus:ring-2 focus:ring-[#5B5FEF] bg-[#F8FAFC] text-sm transition-all`}
            >
              <option value="">Select Position</option>
              {positions.map((pos) => (
                <option key={pos} value={pos}>
                  {pos}
                </option>
              ))}
            </select>
            {errors.position && (
              <span className="text-[#EF4444] text-xs mt-1 block">{errors.position.message}</span>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-semibold text-[#1E293B] mb-1">
              Email Address<span className="text-[#EF4444] ml-0.5">*</span>
            </label>
            <input
              type="email"
              placeholder="name@rmkec.ac.in"
              {...register("email")}
              className={`w-full px-4 py-2.5 rounded-xl border ${
                errors.email ? "border-[#EF4444]" : "border-[#E2E8F0]"
              } focus:outline-none focus:ring-2 focus:ring-[#5B5FEF] bg-[#F8FAFC] text-sm transition-all`}
            />
            {errors.email && (
              <span className="text-[#EF4444] text-xs mt-1 block">{errors.email.message}</span>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-semibold text-[#1E293B] mb-1">
              Password<span className="text-[#EF4444] ml-0.5">*</span>
            </label>
            <input
              type="password"
              placeholder="••••••••"
              {...register("password")}
              className={`w-full px-4 py-2.5 rounded-xl border ${
                errors.password ? "border-[#EF4444]" : "border-[#E2E8F0]"
              } focus:outline-none focus:ring-2 focus:ring-[#5B5FEF] bg-[#F8FAFC] text-sm transition-all`}
            />
            {errors.password && (
              <span className="text-[#EF4444] text-xs mt-1 block">{errors.password.message}</span>
            )}

            {/* Password Strength Indicator */}
            {passValue && (
              <div className="mt-2">
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="text-[#64748B]">Password Strength:</span>
                  <span className="font-semibold">{strength.label}</span>
                </div>
                <div className="h-1.5 w-full bg-[#E2E8F0] rounded-full overflow-hidden">
                  <div className={`h-full ${strength.color} ${strength.width} transition-all duration-300`}></div>
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-semibold text-[#1E293B] mb-1">
              Confirm Password<span className="text-[#EF4444] ml-0.5">*</span>
            </label>
            <input
              type="password"
              placeholder="••••••••"
              {...register("confirmPassword")}
              className={`w-full px-4 py-2.5 rounded-xl border ${
                errors.confirmPassword ? "border-[#EF4444]" : "border-[#E2E8F0]"
              } focus:outline-none focus:ring-2 focus:ring-[#5B5FEF] bg-[#F8FAFC] text-sm transition-all`}
            />
            {errors.confirmPassword && (
              <span className="text-[#EF4444] text-xs mt-1 block">{errors.confirmPassword.message}</span>
            )}
          </div>

          {/* General API Error */}
          {apiError && (
            <div className="p-3 bg-[#FEE2E2] border border-[#EF4444] rounded-xl text-[#EF4444] text-sm font-medium">
              {apiError}
            </div>
          )}

          {/* Register Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-11 bg-gradient-to-r from-[#5B5FEF] to-[#7B7DFF] text-white rounded-xl font-semibold hover:opacity-95 shadow-md transition-all active:scale-[0.98] flex items-center justify-center text-sm disabled:opacity-50"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              "Complete Registration"
            )}
          </button>
        </form>
      </div>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-[#1E293B]/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-[380px] w-full text-center flex flex-col items-center">
            {/* Animated CSS Checkmark Draw */}
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
