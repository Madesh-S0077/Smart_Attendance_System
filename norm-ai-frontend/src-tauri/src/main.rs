// Tauri v2 main.rs — application entry point
// The actual app logic lives in lib.rs

// Prevents an additional console window from appearing in release builds on Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    norm_ai_frontend_lib::run();
}
