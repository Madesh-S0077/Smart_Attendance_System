import { Loader2 } from "lucide-react";

interface LoadingSpinnerProps {
  fullscreen?: boolean;
  message?: string;
}

export default function LoadingSpinner({ fullscreen = false, message = "Loading..." }: LoadingSpinnerProps) {
  if (fullscreen) {
    return (
      <div className="fixed inset-0 bg-[#1E293B]/60 backdrop-blur-xs flex flex-col items-center justify-center gap-3 z-[9999] animate-fade-in">
        <div className="p-6 bg-white border border-[#E2E8F0] rounded-3xl shadow-2xl flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-[#5B5FEF] animate-spin" />
          <span className="text-xs font-bold text-[#1E293B]">{message}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-8 gap-2">
      <Loader2 className="w-6 h-6 text-[#5B5FEF] animate-spin" />
      <span className="text-[10px] font-semibold text-[#64748B]">{message}</span>
    </div>
  );
}
