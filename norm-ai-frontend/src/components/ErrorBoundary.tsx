import { Component, ErrorInfo, ReactNode } from "react";
import { ShieldAlert, RefreshCw } from "lucide-react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Unhandled runtime error captured by ErrorBoundary:", error, errorInfo);
    // In production, you can call a Tauri logging command here.
  }

  private handleRestart = async () => {
    try {
      const isTauriEnv =
        typeof window !== "undefined" &&
        (window as any).__TAURI_INTERNALS__ !== undefined;

      if (isTauriEnv) {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("plugin:process|relaunch");
      } else {
        window.location.href = "/";
      }
    } catch (e) {
      console.warn("Tauri relaunch failed, reloading page instead:", e);
      window.location.href = "/";
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#1E293B] flex items-center justify-center p-6 text-center">
          <div className="bg-white max-w-[420px] w-full p-8 rounded-3xl border border-[#E2E8F0] shadow-2xl flex flex-col items-center gap-5 animate-fade-in">
            <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center text-red-600">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-[#1E293B]">Something went wrong</h1>
              <p className="text-xs text-[#64748B] mt-1.5 leading-relaxed">
                An unhandled error occurred in the application view layer.
              </p>
            </div>

            {this.state.error && (
              <div className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-left overflow-x-auto max-h-[100px]">
                <pre className="text-[10px] text-red-600 font-mono leading-tight">
                  {this.state.error.toString()}
                </pre>
              </div>
            )}

            <button
              onClick={this.handleRestart}
              className="w-full h-11 bg-gradient-to-r from-[#5B5FEF] to-[#7B7DFF] text-white rounded-xl font-bold hover:shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 text-xs"
            >
              <RefreshCw className="w-4 h-4" />
              Restart Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
