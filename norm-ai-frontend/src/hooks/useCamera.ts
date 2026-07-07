import { useState, useRef, useCallback } from "react";

interface CameraState {
  isActive: boolean;
  error: string | null;
  stream: MediaStream | null;
}

/**
 * Manages webcam access for the liveness + face-capture flow.
 * The video element ref is attached to the actual <video> DOM node.
 */
export function useCamera() {
  const [state, setState] = useState<CameraState>({
    isActive: false,
    error: null,
    stream: null,
  });
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setState({ isActive: true, error: null, stream });
    } catch (err) {
      const msg =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Camera access was denied. Please allow camera permission and try again."
          : err instanceof DOMException && err.name === "NotFoundError"
          ? "No camera found on this device."
          : "Failed to access camera. Please check your device settings.";
      setState({ isActive: false, error: msg, stream: null });
    }
  }, []);

  const stopCamera = useCallback(() => {
    state.stream?.getTracks().forEach((track) => track.stop());
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setState({ isActive: false, error: null, stream: null });
  }, [state.stream]);

  /** Capture a single frame from the video stream as a base64 JPEG. */
  const captureFrame = useCallback((): string | null => {
    if (!videoRef.current) return null;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.92);
  }, []);

  return { ...state, videoRef, startCamera, stopCamera, captureFrame };
}
