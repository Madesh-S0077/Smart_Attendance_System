import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { CheckCircle, XCircle, Info, Loader2, X } from "lucide-react";

export type ToastType = "success" | "error" | "info" | "loading";

export interface ToastOptions {
  type: ToastType;
  message: string;
  duration?: number;
  manualClose?: boolean;
}

interface ToastContextType {
  toast: {
    success: (message: string) => void;
    error: (message: string, manualClose?: boolean) => void;
    info: (message: string) => void;
    loading: (message: string) => void;
    dismiss: () => void;
  };
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [activeToast, setActiveToast] = useState<ToastOptions | null>(null);
  const dismissTimerRef = useRef<any | null>(null);

  const dismiss = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    setActiveToast(null);
  }, []);

  const showToast = useCallback((options: ToastOptions) => {
    dismiss();

    setActiveToast(options);

    // If not manual close and not a loading state, schedule dismiss timer
    if (!options.manualClose && options.type !== "loading") {
      const duration = options.duration || (options.type === "error" ? 5000 : 3000);
      dismissTimerRef.current = setTimeout(() => {
        setActiveToast(null);
      }, duration);
    }
  }, [dismiss]);

  const toast = {
    success: useCallback((message: string) => {
      showToast({ type: "success", message });
    }, [showToast]),
    error: useCallback((message: string, manualClose = true) => {
      showToast({ type: "error", message, manualClose });
    }, [showToast]),
    info: useCallback((message: string) => {
      showToast({ type: "info", message });
    }, [showToast]),
    loading: useCallback((message: string) => {
      showToast({ type: "loading", message });
    }, [showToast]),
    dismiss,
  };

  useEffect(() => {
    const handleGlobalToast = (e: Event) => {
      const customEvent = e as CustomEvent<ToastOptions>;
      if (customEvent.detail) {
        showToast(customEvent.detail);
      }
    };
    window.addEventListener("show-toast", handleGlobalToast);
    return () => {
      window.removeEventListener("show-toast", handleGlobalToast);
    };
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      {/* Render Active Toast */}
      {activeToast && (
        <div className="fixed top-6 right-6 z-[9999] min-w-[280px] max-w-[380px] animate-slide-in">
          <div
            className={`p-4 rounded-2xl border shadow-xl flex items-center justify-between gap-3 text-xs font-bold transition-all duration-300 ${
              activeToast.type === "success"
                ? "bg-green-50 border-green-200 text-green-700"
                : activeToast.type === "error"
                ? "bg-red-50 border-red-200 text-red-600"
                : activeToast.type === "info"
                ? "bg-blue-50 border-blue-200 text-blue-700"
                : "bg-slate-50 border-slate-200 text-[#1E293B]"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {activeToast.type === "success" && <CheckCircle className="w-5 h-5 flex-shrink-0" />}
              {activeToast.type === "error" && <XCircle className="w-5 h-5 flex-shrink-0" />}
              {activeToast.type === "info" && <Info className="w-5 h-5 flex-shrink-0" />}
              {activeToast.type === "loading" && <Loader2 className="w-5 h-5 animate-spin flex-shrink-0" />}
              <span className="leading-relaxed">{activeToast.message}</span>
            </div>

            {/* Manual Close X */}
            {(activeToast.manualClose || activeToast.type === "loading" || activeToast.type === "error") && (
              <button
                onClick={dismiss}
                className={`w-5 h-5 rounded-md flex items-center justify-center opacity-70 hover:opacity-100 transition-all ${
                  activeToast.type === "success"
                    ? "hover:bg-green-100"
                    : activeToast.type === "error"
                    ? "hover:bg-red-100"
                    : activeToast.type === "info"
                    ? "hover:bg-blue-100"
                    : "hover:bg-slate-200"
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context.toast;
}

export function showGlobalToast(message: string, type: ToastType = "info", manualClose = false) {
  const event = new CustomEvent("show-toast", {
    detail: { type, message, manualClose },
  });
  window.dispatchEvent(event);
}
