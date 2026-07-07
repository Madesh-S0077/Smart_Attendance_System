import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuthStore } from "../store/authStore";
import apiClient from "../api/client";
import { ApiResponse, UserRole } from "../types";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setApiError(null);
    try {
      const response = await apiClient.post<
        ApiResponse<{
          access_token: string;
          refresh_token: string;
          role: string;
          user_id: string;
        }>
      >("/api/auth/login", data);

      const res = response.data;
      if (res.success && res.data) {
        const { access_token, refresh_token, role, user_id } = res.data;
        // Construct User
        const user = {
          id: user_id,
          email: data.email,
          role: role as UserRole,
          name: role.toUpperCase(), // name field can be populated defaults
        };

        await setAuth(user, access_token, refresh_token);

        // Navigate based on role
        if (role === "student") navigate("/student");
        else if (role === "teacher") navigate("/teacher");
        else if (role === "admin") navigate("/admin");
      } else {
        setApiError(res.error || "Login failed");
      }
    } catch (err: any) {
      if (err.response?.data?.error) {
        setApiError(err.response.data.error);
      } else {
        setApiError("Failed to connect to backend server.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F7F8FC] flex items-center justify-center p-4">
      <div className="w-full max-w-[420px] bg-white rounded-3xl shadow-xl p-10 border border-[#E2E8F0] transform transition duration-300 hover:scale-[1.01]">
        {/* Top Header Section */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-[#5B5FEF]/10 rounded-2xl flex items-center justify-center mb-4">
            <svg
              className="w-10 h-10 text-[#5B5FEF]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-[#5B5FEF] to-[#7B7DFF] bg-clip-text text-transparent">
            Norm AI
          </h1>
          <p className="text-[#64748B] text-sm mt-1">Smart Attendance for RMKEC</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-[#1E293B] mb-2" id="email-label">
              Email Address
            </label>
            <input
              type="email"
              placeholder="you@rmkec.ac.in"
              {...register("email")}
              className={`w-full px-4 py-3 rounded-xl border ${
                errors.email ? "border-[#EF4444] focus:ring-[#EF4444]" : "border-[#E2E8F0] focus:ring-[#5B5FEF]"
              } focus:outline-none focus:ring-2 bg-[#F8FAFC] text-sm transition-all`}
            />
            {errors.email && (
              <span className="text-[#EF4444] text-xs mt-1 block">{errors.email.message}</span>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#1E293B] mb-2" id="password-label">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                {...register("password")}
                className={`w-full px-4 py-3 pr-12 rounded-xl border ${
                  errors.password ? "border-[#EF4444] focus:ring-[#EF4444]" : "border-[#E2E8F0] focus:ring-[#5B5FEF]"
                } focus:outline-none focus:ring-2 bg-[#F8FAFC] text-sm transition-all`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#1E293B] focus:outline-none"
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            {errors.password && (
              <span className="text-[#EF4444] text-xs mt-1 block">{errors.password.message}</span>
            )}
          </div>

          {/* API Error Display */}
          {apiError && (
            <div className="p-3 bg-[#FEE2E2] border border-[#EF4444] rounded-xl text-[#EF4444] text-sm font-medium">
              {apiError}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 bg-gradient-to-r from-[#5B5FEF] to-[#7B7DFF] text-white rounded-xl font-semibold shadow-lg hover:shadow-xl hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center text-sm disabled:opacity-50 disabled:pointer-events-none"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-[#64748B]">
          New to Norm AI?{" "}
          <button
            onClick={() => navigate("/register")}
            className="text-[#5B5FEF] font-semibold hover:underline"
          >
            Register →
          </button>
        </div>
      </div>
    </div>
  );
}
