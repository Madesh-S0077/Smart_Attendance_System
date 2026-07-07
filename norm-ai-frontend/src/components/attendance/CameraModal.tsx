import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { X, RefreshCw, AlertTriangle, ShieldCheck } from "lucide-react";
import apiClient from "../../api/client";
import { ApiResponse } from "../../types";
import { formatDateTime } from "../../utils/date";

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  slotId: string;
  slotName: string;
}

type ModalState = "INIT" | "LIVENESS_CHECK" | "PROCESSING" | "SUCCESS" | "ERROR";

export default function CameraModal({ isOpen, onClose, slotId, slotName }: CameraModalProps) {
  const [modalState, setModalState] = useState<ModalState>("INIT");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [livenessScore, setLivenessScore] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [markedTime, setMarkedTime] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const livenessTimerRef = useRef<any | null>(null);

  // Stop video stream & clear timers
  const cleanUp = () => {
    if (livenessTimerRef.current) {
      clearInterval(livenessTimerRef.current);
      livenessTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    if (isOpen) {
      setModalState("INIT");
      setLivenessScore(0);
      setErrorMessage(null);
      setPhotoDataUrl(null);
      startCamera();
    } else {
      cleanUp();
    }
    return cleanUp;
  }, [isOpen]);

  // Escape key listener to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, modalState]);

  const startCamera = async () => {
    cleanUp();
    setModalState("INIT");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setModalState("LIVENESS_CHECK");
      // Start the 2-second liveness checker loop
      startLivenessChecker();
    } catch (err) {
      console.error("Camera access failed:", err);
      setErrorMessage("Please allow camera access. Verification requires camera access.");
      setModalState("ERROR");
    }
  };

  const startLivenessChecker = () => {
    if (livenessTimerRef.current) clearInterval(livenessTimerRef.current);

    livenessTimerRef.current = setInterval(async () => {
      if (!videoRef.current || !streamRef.current) return;

      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Draw mirrored video frame
      ctx.translate(640, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(videoRef.current, 0, 0, 640, 480);
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      const dataUrl = canvas.toDataURL("image/jpeg");
      const base64Data = dataUrl.split(",")[1];

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
          console.warn("Liveness Sidecar warning:", res.error);
          setLivenessScore(0);
          return;
        }

        // Animate liveness feedback
        const scorePct = Math.round(res.liveness_score * 100);
        setLivenessScore(scorePct);

        if (res.is_live && res.liveness_score > 0.85 && res.embedding) {
          // Success liveness verification -> Move to PROCESSING
          setPhotoDataUrl(dataUrl);
          cleanUp();
          setModalState("PROCESSING");
          verifyIdentity(res.embedding, res.liveness_score);
        }
      } catch (err) {
        console.error("Failed to fetch liveness checks:", err);
      }
    }, 2000);
  };

  // Submit embedding to backend `/api/attendance/verify`
  const verifyIdentity = async (embedding: number[], score: number) => {
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const response = await apiClient.post<ApiResponse<any>>("/api/attendance/verify", {
        face_embedding: embedding,
        date: todayStr,
      });

      const res = response.data;
      if (res.success) {
        setMarkedTime(`Marked at ${formatDateTime(new Date())}`);
        setModalState("SUCCESS");
      } else {
        setErrorMessage(res.error || "Verification failed");
        setModalState("ERROR");
      }
    } catch (err: any) {
      if (err.response?.data?.error) {
        setErrorMessage(err.response.data.error);
      } else {
        setErrorMessage("Verification server communication failed.");
      }
      setModalState("ERROR");
    }
  };

  const handleClose = () => {
    if (modalState === "PROCESSING") {
      if (!window.confirm("Verification is in progress. Exit verification?")) {
        return;
      }
    }
    cleanUp();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#1E293B]/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white w-full max-w-[480px] rounded-3xl shadow-2xl border border-[#E2E8F0] overflow-hidden flex flex-col justify-between relative transform transition-all p-8 text-center min-h-[500px]">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-6 right-6 w-10 h-10 bg-[#F8FAFC] hover:bg-[#F1F5F9] rounded-full flex items-center justify-center text-[#64748B] hover:text-[#1E293B] transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* ── INIT & LIVENESS CHECK ────────────────────────────────────────── */}
        {(modalState === "INIT" || modalState === "LIVENESS_CHECK") && (
          <div className="flex-1 flex flex-col justify-between">
            <div>
              <h2 className="text-xl font-bold text-[#1E293B] mb-1">{slotName}</h2>
              <p className="text-xs text-[#64748B]">Secure Face Liveness Scan</p>
            </div>

            {/* Video Feed */}
            <div className="relative aspect-[4/3] w-full bg-[#1E293B] rounded-2xl overflow-hidden shadow-inner my-6">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
              />

              {/* Square overlay guide */}
              <div className="absolute inset-0 border-[40px] border-[#1E293B]/70 flex items-center justify-center pointer-events-none">
                <div className="w-[160px] h-[160px] border-2 border-dashed border-[#5B5FEF] rounded-2xl shadow-[0_0_0_9999px_rgba(30,41,59,0.4)]"></div>
              </div>

              {/* Live Status overlay */}
              {modalState === "LIVENESS_CHECK" && (
                <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-xs px-2.5 py-1 rounded-lg text-[10px] text-white flex items-center gap-1.5 font-bold tracking-wider">
                  <span className="w-2 h-2 bg-[#22C55E] rounded-full animate-ping"></span>
                  SCANNING
                </div>
              )}
            </div>

            <div className="space-y-4">
              {/* Liveness Progress bar */}
              <div>
                <div className="flex justify-between items-center text-xs text-[#64748B] font-semibold mb-1">
                  <span>Liveness Score:</span>
                  <span>{livenessScore}%</span>
                </div>
                <div className="h-2 w-full bg-[#E2E8F0] rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r from-[#5B5FEF] to-[#7B7DFF] transition-all duration-300`}
                    style={{ width: `${livenessScore}%` }}
                  ></div>
                </div>
              </div>

              <p className="text-xs text-[#64748B] leading-relaxed">
                Position your face centered in the <span className="font-bold">square overlay</span>. Hold still for authentication...
              </p>
            </div>
          </div>
        )}

        {/* ── PROCESSING STATE ──────────────────────────────────────────────── */}
        {modalState === "PROCESSING" && (
          <div className="flex-1 flex flex-col justify-center items-center py-8">
            <div className="w-20 h-20 rounded-2xl bg-[#5B5FEF]/10 flex items-center justify-center text-[#5B5FEF] mb-6">
              <RefreshCw className="w-10 h-10 animate-spin" />
            </div>
            <h2 className="text-xl font-bold text-[#1E293B] mb-2">Verifying Identity</h2>
            <p className="text-sm text-[#64748B] mb-6">Matching your face embedding with RMKEC records...</p>

            {photoDataUrl && (
              <div className="w-28 h-28 rounded-2xl border-2 border-[#5B5FEF]/20 overflow-hidden shadow-md">
                <img src={photoDataUrl} className="w-full h-full object-cover" />
              </div>
            )}
          </div>
        )}

        {/* ── SUCCESS STATE ─────────────────────────────────────────────────── */}
        {modalState === "SUCCESS" && (
          <div className="flex-1 flex flex-col justify-center items-center py-8">
            <div className="w-16 h-16 bg-[#22C55E]/10 rounded-full flex items-center justify-center text-[#22C55E] mb-6 animate-pulse">
              <ShieldCheck className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-extrabold text-[#1E293B] mb-2">Attendance Marked! ✓</h2>
            <p className="text-sm text-[#22C55E] font-semibold mb-4">{slotName}</p>
            <p className="text-xs text-[#64748B] mb-8">{markedTime}</p>

            <button
              onClick={handleClose}
              className="w-full h-11 bg-[#22C55E] text-white rounded-xl font-semibold hover:shadow-lg transition-all active:scale-95 text-sm"
            >
              Done
            </button>
          </div>
        )}

        {/* ── ERROR STATE ───────────────────────────────────────────────────── */}
        {modalState === "ERROR" && (
          <div className="flex-1 flex flex-col justify-center items-center py-8">
            <div className="w-16 h-16 bg-[#EF4444]/10 rounded-full flex items-center justify-center text-[#EF4444] mb-6">
              <AlertTriangle className="w-10 h-10" />
            </div>
            <h2 className="text-xl font-bold text-[#1E293B] mb-2">Verification Failed</h2>
            <p className="text-sm text-[#EF4444] font-medium mb-6 max-w-[300px] leading-relaxed">
              {errorMessage || "Attendance marking failed. Please try again."}
            </p>

            <div className="flex gap-3 w-full">
              <button
                onClick={handleClose}
                className="flex-1 h-11 border border-[#E2E8F0] text-[#64748B] rounded-xl font-semibold hover:bg-[#F8FAFC] transition-all text-sm"
              >
                Cancel
              </button>
              <button
                onClick={startCamera}
                className="flex-1 h-11 bg-[#5B5FEF] text-white rounded-xl font-semibold hover:shadow-lg transition-all active:scale-95 text-sm"
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
