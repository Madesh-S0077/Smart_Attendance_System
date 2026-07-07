import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/authStore";
import { UserRole } from "./types";

// Pages
import Login from "./pages/Login";
import Register from "./pages/Register";
import RegisterStudent from "./pages/RegisterStudent";
import RegisterTeacher from "./pages/RegisterTeacher";
import StudentDashboard from "./pages/StudentDashboard";
import TeacherDashboard from "./pages/TeacherDashboard";
import AdminDashboard from "./pages/AdminDashboard";

const isTauriEnv =
  typeof window !== "undefined" &&
  (window as any).__TAURI_INTERNALS__ !== undefined;

// ── Protected route ───────────────────────────────────────────────────────────
function ProtectedRoute({
  children,
  allowedRole,
}: {
  children: React.ReactNode;
  allowedRole: UserRole;
}) {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== allowedRole) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const [sidecarReady, setSidecarReady] = useState(!isTauriEnv);
  const [sidecarError, setSidecarError] = useState<string | null>(null);

  useEffect(() => {
    if (!isTauriEnv) return;

    let attempts = 0;
    const maxAttempts = 15; // 30 seconds total (15 * 2s)

    const checkSidecar = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8765/health");
        const data = await res.json();
        if (data.status === "ready") {
          setSidecarReady(true);
          return true;
        }
      } catch (err) {
        console.debug("Sidecar health check failed, retrying...", err);
      }
      return false;
    };

    // Initial check
    checkSidecar().then((ready) => {
      if (ready) return;

      const interval = setInterval(async () => {
        attempts++;
        const ready = await checkSidecar();
        if (ready) {
          clearInterval(interval);
        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
          setSidecarError("AI pipeline failed to start. Please restart the app.");
        }
      }, 2000);
    });
  }, []);

  if (!sidecarReady) {
    return (
      <div className="min-h-screen bg-[#1E293B] flex items-center justify-center p-6 text-center">
        <div className="bg-white max-w-[400px] w-full p-8 rounded-3xl border border-[#E2E8F0] shadow-2xl flex flex-col items-center gap-4 animate-fade-in">
          {sidecarError ? (
            <>
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h1 className="text-lg font-bold text-[#1E293B]">AI System Error</h1>
              <p className="text-xs text-[#64748B] leading-relaxed">{sidecarError}</p>
            </>
          ) : (
            <>
              <div className="w-12 h-12 border-4 border-[#5B5FEF] border-t-transparent rounded-full animate-spin"></div>
              <h1 className="text-lg font-bold text-[#1E293B]">AI System Loading...</h1>
              <p className="text-xs text-[#64748B] leading-relaxed">
                Initializing local facial recognition and liveness pipeline. Please wait.
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/register/student" element={<RegisterStudent />} />
        <Route path="/register/teacher" element={<RegisterTeacher />} />

        {/* Protected — Student */}
        <Route
          path="/student/*"
          element={
            <ProtectedRoute allowedRole="student">
              <StudentDashboard />
            </ProtectedRoute>
          }
        />

        {/* Protected — Teacher */}
        <Route
          path="/teacher/*"
          element={
            <ProtectedRoute allowedRole="teacher">
              <TeacherDashboard />
            </ProtectedRoute>
          }
        />

        {/* Protected — Admin */}
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute allowedRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
