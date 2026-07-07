/// wifi.rs — Tauri command to retrieve the currently connected WiFi SSID.
///
/// On Windows, we call `netsh wlan show interfaces` and parse the SSID line.
/// On macOS, we use the `airport` command.
/// On Linux, we use `iwgetid`.
///
/// Returns `None` if no WiFi interface is connected or the command fails.

#[tauri::command]
pub async fn get_wifi_ssid() -> Result<Option<String>, String> {
    #[cfg(target_os = "windows")]
    {
        get_ssid_windows().map_err(|e| e.to_string())
    }
    #[cfg(target_os = "macos")]
    {
        get_ssid_macos().map_err(|e| e.to_string())
    }
    #[cfg(target_os = "linux")]
    {
        get_ssid_linux().map_err(|e| e.to_string())
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Err("WiFi SSID detection is not supported on this platform.".to_string())
    }
}

// ── Windows implementation ────────────────────────────────────────────────────
#[cfg(target_os = "windows")]
fn get_ssid_windows() -> Result<Option<String>, Box<dyn std::error::Error>> {
    use std::process::Command;

    let output = Command::new("netsh")
        .args(["wlan", "show", "interfaces"])
        .output()?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    for line in stdout.lines() {
        let trimmed = line.trim();
        // Match "SSID             : MyNetwork" but NOT "BSSID"
        if trimmed.starts_with("SSID") && !trimmed.starts_with("BSSID") {
            if let Some(ssid) = trimmed.splitn(2, ':').nth(1) {
                let ssid = ssid.trim().to_string();
                if !ssid.is_empty() {
                    return Ok(Some(ssid));
                }
            }
        }
    }
    Ok(None)
}

// ── macOS implementation ──────────────────────────────────────────────────────
#[cfg(target_os = "macos")]
fn get_ssid_macos() -> Result<Option<String>, Box<dyn std::error::Error>> {
    use std::process::Command;

    let output = Command::new("/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport")
        .arg("-I")
        .output()?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    for line in stdout.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("SSID:") {
            if let Some(ssid) = trimmed.splitn(2, ':').nth(1) {
                let ssid = ssid.trim().to_string();
                if !ssid.is_empty() {
                    return Ok(Some(ssid));
                }
            }
        }
    }
    Ok(None)
}

// ── Linux implementation ──────────────────────────────────────────────────────
#[cfg(target_os = "linux")]
fn get_ssid_linux() -> Result<Option<String>, Box<dyn std::error::Error>> {
    use std::process::Command;

    let output = Command::new("iwgetid").args(["-r"]).output()?;
    let ssid = String::from_utf8_lossy(&output.stdout).trim().to_string();
    Ok(if ssid.is_empty() { None } else { Some(ssid) })
}
