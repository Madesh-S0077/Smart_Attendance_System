mod commands;

use commands::wifi::get_wifi_ssid;
use commands::camera::capture_frame;

use tauri::Manager;
use tauri_plugin_shell::ShellExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .setup(|app| {
            // ── Spawn AI sidecar process ──────────────────────────────────────
            // The sidecar starts a local HTTP server on 127.0.0.1:8765.
            // In dev mode: Tauri looks for the binary at src-tauri/sidecar/ai_pipeline
            // In production: PyInstaller-built binary bundled via externalBin.
            let sidecar_command = app
                .shell()
                .sidecar("ai_pipeline")
                .map_err(|e| {
                    eprintln!("[Norm AI] Failed to prepare sidecar command: {e}");
                    e
                })?;

            let (_rx, child) = sidecar_command
                .spawn()
                .map_err(|e| {
                    eprintln!("[Norm AI] Failed to spawn AI sidecar: {e}");
                    e
                })?;

            // Store the child handle so Tauri keeps it alive for the app lifetime.
            // Dropping it would kill the sidecar process.
            app.manage(child);

            eprintln!("[Norm AI] ✅ AI sidecar spawned on 127.0.0.1:8765");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_wifi_ssid,
            capture_frame,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
