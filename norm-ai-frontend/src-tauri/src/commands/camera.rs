/// camera.rs — Tauri command helpers for camera frame capture.
///
/// The actual video stream is managed in the React frontend using the
/// Web MediaDevices API. This file provides helper commands for any
/// native camera operations that cannot be done via browser APIs inside Tauri.

/// Returns a list of available video input device names.
/// This is a lightweight alternative to enumerateDevices() for native contexts.
#[tauri::command]
pub async fn capture_frame() -> Result<String, String> {
    // Frame capture is handled entirely in the React frontend via
    // the useCamera hook (MediaDevices API + Canvas).
    // This command exists as a hook point for future native camera
    // integration (e.g., DSLR, IP camera, or USB camera drivers).
    Ok("Frame capture is handled via the browser MediaDevices API. \
        Use the useCamera() React hook to capture frames.".to_string())
}
