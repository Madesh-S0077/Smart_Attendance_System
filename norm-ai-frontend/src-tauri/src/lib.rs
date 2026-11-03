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
            // Non-fatal: if the bundled binary is missing (dev), or port 8765 is already
            // served by a manually started `python ai_pipeline.py`, keep the app running.
            match app.shell().sidecar("ai_pipeline").and_then(|c| c.spawn()) {
                Ok((_rx, child)) => {
                    // Keep the child handle alive; dropping it would kill the sidecar.
                    app.manage(child);
                    eprintln!("[Norm AI] AI sidecar spawned on 127.0.0.1:8765");
                }
                Err(e) => eprintln!(
                    "[Norm AI] Sidecar not spawned ({e}). Start it manually: python ai_pipeline.py"
                ),
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_wifi_ssid,
            capture_frame,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
