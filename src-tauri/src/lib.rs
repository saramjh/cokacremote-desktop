use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};
use tauri::{AppHandle, Manager};
use tauri_plugin_clipboard_manager::ClipboardExt;

const ALLOWED_LANGUAGES: &[&str] = &["en", "ko", "ja", "zh", "es", "fr", "de"];
const ALLOWED_ACTIONS: &[&str] = &["setup", "restart", "stop"];

fn home() -> Result<PathBuf, String> {
    std::env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" })
        .map(PathBuf::from)
        .ok_or_else(|| "User home directory is unavailable".into())
}

fn resource(app: &AppHandle, relative: &str) -> Result<PathBuf, String> {
    // Tauri embeds only the explicitly declared operational scripts.
    let path = app
        .path()
        .resource_dir()
        .map_err(|e| e.to_string())?
        .join("resources")
        .join(relative);
    if path.is_file() {
        Ok(path)
    } else {
        Err(format!("Packaged controller is missing: {relative}"))
    }
}

fn run_with_timeout(mut command: Command, timeout_ms: u64) -> Result<Output, String> {
    use std::time::{Duration, Instant};
    let mut child = command
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .stdin(std::process::Stdio::null())
        .spawn()
        .map_err(|e| format!("Controller unavailable: {e}"))?;
    let start = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(_)) => return child.wait_with_output().map_err(|e| e.to_string()),
            Ok(None) if start.elapsed() < Duration::from_millis(timeout_ms) => {
                std::thread::sleep(Duration::from_millis(100));
            }
            Ok(None) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err("Controller timed out. Existing processes were not forcefully stopped.".into());
            }
            Err(e) => return Err(format!("Controller process status unavailable: {e}")),
        }
    }
}

#[cfg(target_os = "macos")]
fn node_path() -> Result<PathBuf, String> {
    for path in [
        "/opt/homebrew/bin/node",
        "/usr/local/bin/node",
        "/usr/bin/node",
    ] {
        if Path::new(path).is_file() {
            return Ok(PathBuf::from(path));
        }
    }
    Err("Node.js is not installed. Install Node.js before configuring cokacremote.".into())
}

// Sandbox-only Tauri functional lane. A staging bundle may operate ONLY inside
// a disposable macOS temp profile, never on the connected production service.
#[cfg(target_os = "macos")]
fn sandbox_profile(app: &AppHandle) -> Result<Option<PathBuf>, String> {
    let Some(raw) = std::env::var_os("COKAC_MANAGER_SANDBOX_ROOT") else {return Ok(None)};
    let mode_file = resource(app, "manager-build-mode.json")?;
    let mode: Value = serde_json::from_slice(&fs::read(mode_file).map_err(|_| "No build identity".to_string())?)
        .map_err(|_| "Invalid build identity".to_string())?;
    if mode["mode"].as_str() != Some("staging") {return Err("Sandbox profile only valid in staging build".into())}
    let root = fs::canonicalize(PathBuf::from(raw)).map_err(|_| "Sandbox root missing".to_string())?;
    let tmp = fs::canonicalize(std::env::temp_dir()).map_err(|_| "Cannot verify temporary root".to_string())?;
    let name = root.file_name().and_then(|n| n.to_str()).unwrap_or("");
    if !root.starts_with(&tmp) || !name.starts_with("cokac-manager-native-e2e-")
        || !root.join("profile.json").is_file() {
        return Err("Refusing non-isolated sandbox target".into());
    }
    Ok(Some(root))
}

#[cfg(target_os = "macos")]
fn sandbox_cli_command(app: &AppHandle, action: &str, root: &Path) -> Result<Value, String> {
    let script = resource(app, "platform/mac/sandbox-cli.mjs")?;
    let mut command = Command::new(node_path()?);
    command.arg(script).arg(action).arg(root);
    let output = run_with_timeout(command, 30_000)?;
    if !output.status.success() {
        return Err("Isolated native Manager action failed; live MCP remains untouched".into());
    }
    serde_json::from_slice(&output.stdout).map_err(|_| "Sandbox controller returned invalid status".into())
}

#[cfg(target_os = "macos")]
fn command_status(app: &AppHandle, remote: bool) -> Result<Value, String> {
    if let Some(root) = sandbox_profile(app)? {
        let _ = remote;
        return sandbox_cli_command(app, "status", &root);
    }
    let script = resource(app, "platform/mac/status.mjs")?;
    let mut command = Command::new(node_path()?);
    command.arg(script);
    if remote {
        command.arg("--remote");
    }
    let output = run_with_timeout(command, if remote { 45_000 } else { 12_000 })?;
    if !output.status.success() {
        return Err("macOS service probe failed. The existing connection has not been changed.".into());
    }
    serde_json::from_slice(&output.stdout).map_err(|e| format!("Invalid service state response: {e}"))
}

#[cfg(windows)]
fn windows_deploy() -> Result<PathBuf, String> {
    Ok(home()?.join("MCPWorkspace").join("cokacremote").join("deploy").join("windows"))
}

#[cfg(windows)]
fn powershell() -> PathBuf {
    PathBuf::from(std::env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".into()))
        .join("System32")
        .join("WindowsPowerShell")
        .join("v1.0")
        .join("powershell.exe")
}

#[cfg(windows)]
fn command_status(_app: &AppHandle, remote: bool) -> Result<Value, String> {
    let script = windows_deploy()?.join("gui").join("status.ps1");
    if !script.is_file() {
        return Err("Existing Windows MCP installation was not found. Install its supervisor first.".into());
    }
    let mut command = Command::new(powershell());
    command.args(["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File"])
        .arg(script);
    if remote {
        command.arg("-VerifyRemote");
    }
    let output = run_with_timeout(command, if remote { 45_000 } else { 12_000 })?;
    if !output.status.success() {
        return Err("Windows service probe failed. Current processes remain untouched.".into());
    }
    let value: Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Invalid service state response: {e}"))?;
    Ok(value)
}

#[tauri::command]
async fn manager_status(app: AppHandle, remote: bool) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || command_status(&app, remote))
        .await
        .map_err(|e| format!("Service diagnosis interrupted: {e}"))?
}

#[cfg(target_os = "macos")]
fn execute_action(app: &AppHandle, action: &str) -> Result<Value, String> {
    if let Some(root) = sandbox_profile(app)? {
        return sandbox_cli_command(app, action, &root);
    }
    let script = resource(app, "platform/mac/operate.mjs")?;
    let mut command = Command::new(node_path()?);
    command.arg(script).arg(action);
    let output = run_with_timeout(command, 180_000)?;
    if !output.status.success() {
        return Err("macOS controller could not complete the operation. Check existing logs; no automatic duplicate request was sent.".into());
    }
    serde_json::from_slice(&output.stdout).map_err(|e| format!("Controller result could not be verified: {e}"))
}

#[cfg(windows)]
fn execute_action(_app: &AppHandle, action: &str) -> Result<Value, String> {
    let script = windows_deploy()?.join("cokacremote.ps1");
    if !script.is_file() {
        return Err("Windows MCP controller not installed. Run the Windows installer first.".into());
    }
    let mut command = Command::new(powershell());
    command.args(["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File"])
        .arg(script)
        .args(["-Action", action, "-HideApprovalKey"]);
    let output = run_with_timeout(command, 180_000)?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    if !output.status.success() || stdout.contains("SETUP FAILED:") {
        return Err("Windows controller failed. Check the existing supervisor logs; do not retry blindly.".into());
    }
    Ok(json!({"result":"EXECUTED"}))
}

// All packaged development builds fail closed, even if the JS stage fence is absent
// from Tauri's resource directory. Release promotion requires a separate audited gate.
fn verify_mutating_build(app: &AppHandle) -> Result<(), String> {
    let mode_file = resource(app, "manager-build-mode.json")?;
    let bytes = fs::read(mode_file).map_err(|_| "Build mode could not be verified".to_string())?;
    let mode: Value = serde_json::from_slice(&bytes)
        .map_err(|_| "Invalid build mode metadata".to_string())?;
    if !matches!(mode["mode"].as_str(), Some("release-candidate") | Some("production")) {
        return Err("STAGING_ONLY: this Manager build must not change the live MCP service".into());
    }
    Ok(())
}

#[tauri::command]
async fn manager_install_dependencies(
    app: AppHandle,
    consent: bool,
    approved_missing: Vec<String>,
) -> Result<Value, String> {
    if !consent {
        return Err("Explicit user consent is required".into());
    }
    verify_mutating_build(&app)?;
    #[cfg(target_os = "macos")]
    {
        let script = resource(&app, "platform/mac/install-deps.mjs")?;
        let mut command = Command::new(node_path()?);
        command.arg(script).arg("--consent").args(approved_missing);
        let result = tauri::async_runtime::spawn_blocking(move || run_with_timeout(command, 360_000))
            .await.map_err(|e| e.to_string())??;
        if !result.status.success() {
            return Err("Dependency installation failed; check the system package manager and retry only after review".into());
        }
        return serde_json::from_slice(&result.stdout).map_err(|_| "Dependency verification response invalid".into());
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = approved_missing;
        Err("Install workflow is not available on this platform".into())
    }
}

#[tauri::command]
async fn manager_operate(app: AppHandle, action: String) -> Result<Value, String> {
    #[cfg(target_os="macos")]
    if sandbox_profile(&app)?.is_none() { verify_mutating_build(&app)?; }
    #[cfg(not(target_os="macos"))]
    verify_mutating_build(&app)?;
    if !ALLOWED_ACTIONS.contains(&action.as_str()) {
        return Err("Operation not permitted".into());
    }
    let cloned = app.clone();
    let result = tauri::async_runtime::spawn_blocking(move || execute_action(&cloned, &action))
        .await
        .map_err(|e| format!("Controller interruption: {e}"))??;
    Ok(result)
}

fn approval_key_file() -> Result<PathBuf, String> {
    Ok(home()?.join(".cokacremote").join("oauth-approval-key"))
}

fn key_value() -> Result<String, String> {
    let raw = fs::read_to_string(approval_key_file()?)
        .map_err(|_| "Approval key does not exist. Configure the MCP server first.".to_string())?;
    let key = raw.trim();
    if key.len() < 32 || key.len() > 256 || !key.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
        return Err("Approval key has an unexpected format".into());
    }
    Ok(key.into())
}

// Read only bounded tails from the three known per-user service log files.
// Never accept a caller-supplied filename or follow a symlink.
const LOG_TAIL_BYTES: usize = 64 * 1024;
const LOG_TAIL_LINES: usize = 180;
fn redact_log(input: &str, secret: Option<&str>) -> String {
    use regex::Regex;
    let mut text=input.to_string();
    if let Some(key)=secret {
        if key.len() >= 16 { text=text.replace(key,"[REDACTED KEY]"); }
    }
    for (pattern,replacement) in [
        (r#"(?i)https://[a-z0-9-]+\.trycloudflare\.com(?:/[^\s"'<>]*)?"#, "[REDACTED TUNNEL URL]"),
        (r"(?i)(bearer\s+)[a-z0-9._~+/\-]+=*", "$1[REDACTED]"),
    ] {
        if let Ok(re)=Regex::new(pattern) { text=re.replace_all(&text,replacement).into_owned(); }
    }
    if let Ok(re)=Regex::new(r#"(?i)((?:access_token|refresh_token|client_secret|id_token|oauth[_\- ]?approval[_\- ]?key|authorization|cookie)\s*[:=]\s*["']?)[^\s&"',;}]+"#) {
        text=re.replace_all(&text,"$1[REDACTED]").into_owned();
    }
    text
}
fn snapshot_logs(base: &Path, source: &str) -> Result<Value,String> {
    use std::io::{Read,Seek,SeekFrom};
    let filename=match source {
        "server"=>"cokacremote.log",
        "tunnel"=>"cloudflared.log",
        "manager"=>if base.join("manager-worker.log").exists() {"manager-worker.log"} else {"manager-launchd-error.log"},
        _=>return Err("Unknown log source".into())
    };
    let path=base.join(filename);
    let metadata=match fs::symlink_metadata(&path) {
        Ok(meta)=>meta,
        Err(e) if e.kind()==std::io::ErrorKind::NotFound =>
            return Ok(json!({"source":source,"available":false,"text":"","truncated":false,"lineCount":0})),
        Err(_)=>return Err("Unable to inspect log file".into())
    };
    if !metadata.file_type().is_file() || metadata.file_type().is_symlink() {
        return Err("Log path is not a regular file".into());
    }
    let mut file=fs::File::open(&path).map_err(|_|"Log file is not readable".to_string())?;
    let length=metadata.len();
    let length_to_read=(length as usize).min(LOG_TAIL_BYTES);
    let mut data=vec![0_u8;length_to_read];
    file.seek(SeekFrom::Start(length.saturating_sub(length_to_read as u64)))
        .map_err(|_|"Log seek failed".to_string())?;
    file.read_exact(&mut data).map_err(|_|"Log read failed".to_string())?;
    let decoded=String::from_utf8_lossy(&data);
    let mut lines=decoded.lines();
    if length>LOG_TAIL_BYTES as u64 { lines.next(); } // discard a partial first line
    let all:Vec<&str>=lines.collect();
    let line_count=all.len().min(LOG_TAIL_LINES);
    let tail=all[all.len().saturating_sub(LOG_TAIL_LINES)..].join("\n");
    let key=fs::read_to_string(base.join("oauth-approval-key")).ok();
    let text=redact_log(&tail,key.as_deref().map(str::trim));
    Ok(json!({"source":source,"available":true,"text":text,"truncated":length>LOG_TAIL_BYTES as u64 || all.len()>LOG_TAIL_LINES,"lineCount":line_count}))
}
#[tauri::command]
async fn manager_logs(source:String) -> Result<Value,String> {
    if !["server","tunnel","manager"].contains(&source.as_str()) { return Err("Unknown log source".into()); }
    tauri::async_runtime::spawn_blocking(move ||
        snapshot_logs(&home()?.join(".cokacremote"),&source)
    ).await.map_err(|e| e.to_string())?
}

#[tauri::command]
fn manager_reveal(app: AppHandle) -> Result<String, String> {
    #[cfg(target_os="macos")]
    if sandbox_profile(&app)?.is_some() {return Err("Sandbox credentials are not revealed".into());}
    let _ = app;
    key_value()
}

#[tauri::command]
fn manager_copy(app: AppHandle, kind: String) -> Result<bool, String> {
    #[cfg(target_os="macos")]
    if sandbox_profile(&app)?.is_some() {return Err("Sandbox fixture credentials and URLs cannot be copied".into());}
    let content = match kind.as_str() {
        "key" => key_value()?,
        "url" => {
            // A public URL may only be copied from freshly observed local state.
            let state = command_status(&app, false)?;
            let url = state["endpoint"].as_str().unwrap_or("");
            if !url.starts_with("https://") || !url.ends_with(".com/mcp") || url.contains(char::is_whitespace) {
                return Err("Verified MCP URL is unavailable".into());
            }
            url.to_owned()
        }
        _ => return Err("Unknown copy target".into()),
    };
    app.clipboard().write_text(content).map_err(|e| format!("Clipboard unavailable: {e}"))?;
    Ok(true)
}

fn preferences(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| format!("Cannot create preference directory: {e}"))?;
    Ok(dir.join("ui-preferences.json"))
}

#[tauri::command]
fn manager_language(app: AppHandle) -> Result<Value, String> {
    let selected: Option<String> = fs::read_to_string(preferences(&app)?)
        .ok()
        .and_then(|s| serde_json::from_str::<Value>(&s).ok())
        .and_then(|v| v["language"].as_str().map(str::to_string))
        .filter(|code| ALLOWED_LANGUAGES.contains(&code.as_str()));
    Ok(json!({"selected":selected,"system":sys_locale::get_locale().unwrap_or_else(|| "en".into())}))
}

#[tauri::command]
fn manager_set_language(app: AppHandle, code: String) -> Result<Value, String> {
    if !ALLOWED_LANGUAGES.contains(&code.as_str()) {
        return Err("Unsupported language".into());
    }
    let file = preferences(&app)?;
    let payload = json!({"schema":1,"language":code}).to_string();
    let temp = file.with_extension(format!("{}.tmp", std::process::id()));
    fs::write(&temp, payload).map_err(|e| format!("Cannot save language: {e}"))?;
    if file.exists() {
        fs::remove_file(&file).map_err(|e| format!("Cannot update language: {e}"))?;
    }
    fs::rename(&temp, &file).map_err(|e| format!("Cannot commit language: {e}"))?;
    Ok(json!({"language":code}))
}

#[tauri::command]
fn manager_open_chat() -> Result<(), String> {
    open::that("https://chatgpt.com/").map_err(|e| e.to_string())
}

#[tauri::command]
fn manager_minimize(app: AppHandle) -> Result<(), String> {
    app.get_webview_window("main")
        .ok_or_else(|| "Main window unavailable".to_string())?
        .minimize()
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn manager_close(app: AppHandle) -> Result<(), String> {
    app.get_webview_window("main")
        .ok_or_else(|| "Main window unavailable".to_string())?
        .close()
        .map_err(|e| e.to_string())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![
            manager_status,
            manager_operate,
            manager_install_dependencies,
            manager_copy,
            manager_logs,
            manager_reveal,
            manager_language,
            manager_set_language,
            manager_open_chat,
            manager_minimize,
            manager_close
        ])
        .run(tauri::generate_context!())
        .expect("Could not start cokacremote Manager");
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn allowlisted_actions_only() {
        assert!(ALLOWED_ACTIONS.contains(&"setup"));
        assert!(!ALLOWED_ACTIONS.contains(&"shell"));
        assert!(!ALLOWED_ACTIONS.contains(&"delete"));
    }
    #[test]
    fn supported_language_contract() {
        assert_eq!(ALLOWED_LANGUAGES, &["en", "ko", "ja", "zh", "es", "fr", "de"]);
    }
}
