use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Output, Stdio};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager};
use tauri_plugin_clipboard_manager::ClipboardExt;

const LANGUAGES: &[&str] = &["en", "ko", "ja", "zh", "es", "fr", "de"];
const ACTIONS: &[&str] = &["setup", "restart", "stop"];
const DEPENDENCIES: &[&str] = &["node", "git", "cloudflared", "cokacremote"];

fn home() -> Result<PathBuf, String> {
    std::env::var_os("HOME").map(PathBuf::from)
        .ok_or_else(|| "HOME not available".to_string())
}

fn resource(app: &AppHandle, relative: &str) -> Result<PathBuf, String> {
    let path = app.path().resource_dir().map_err(|e| e.to_string())?
        .join("resources").join(relative);
    if path.is_file() { Ok(path) }
    else { Err(format!("Missing packaged controller resource: {relative}")) }
}

fn node_path() -> Result<PathBuf, String> {
    for path in ["/opt/homebrew/bin/node", "/usr/local/bin/node", "/usr/bin/node"] {
        if Path::new(path).is_file() { return Ok(PathBuf::from(path)); }
    }
    Err("Node.js not installed; use the dependency setup panel".into())
}

// GUI never evaluates shell strings. Executable and script are selected from a fixed allowlist.
// Timeouts terminate only this child controller, never an unrelated server or tunnel process.
fn run(mut command: Command, deadline_ms: u64) -> Result<Output, String> {
    let mut child = command.stdin(Stdio::null()).stdout(Stdio::piped())
        .stderr(Stdio::piped()).spawn()
        .map_err(|e| format!("Unable to start controller: {e}"))?;
    let start = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(_)) => return child.wait_with_output().map_err(|e| e.to_string()),
            Ok(None) if start.elapsed() < Duration::from_millis(deadline_ms) =>
                std::thread::sleep(Duration::from_millis(100)),
            Ok(None) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err("Controller timed out. Check state before retrying.".into());
            }
            Err(e) => return Err(format!("Controller status unknown: {e}")),
        }
    }
}

fn json_output(output: Output) -> Result<Value, String> {
    if !output.status.success() {
        return Err("Controller failed. No automatic retry was performed.".into());
    }
    let stdout = String::from_utf8(output.stdout)
        .map_err(|_| "Controller output was not valid UTF-8".to_string())?;
    // Install helpers emit diagnostic progress before their final one-line JSON receipt.
    let last = stdout.lines().rev().find(|s| s.trim_start().starts_with('{'))
        .ok_or_else(|| "Controller did not return a JSON receipt".to_string())?;
    serde_json::from_str(last).map_err(|e| format!("Invalid JSON receipt: {e}"))
}

fn node_script(app: &AppHandle, script: &str, args: &[&str], timeout: u64) -> Result<Value, String> {
    let file = resource(app, script)?;
    let mut command = Command::new(node_path()?);
    command.arg(file).args(args);
    json_output(run(command, timeout)?)
}

#[tauri::command]
async fn manager_status(app: AppHandle, remote: bool) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        node_script(&app, "platform/mac/status.mjs",
            if remote { &["--remote"][..] } else { &[][..] },
            if remote { 50_000 } else { 15_000 })
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn manager_operate(app: AppHandle, action: String) -> Result<Value, String> {
    if !ACTIONS.contains(&action.as_str()) { return Err("Operation not permitted".into()); }
    tauri::async_runtime::spawn_blocking(move || {
        node_script(&app, "platform/mac/operate.mjs", &[&action], 180_000)
    }).await.map_err(|e| e.to_string())?
}

fn bootstrap(app: &AppHandle, args: &[&str], timeout: u64) -> Result<Value, String> {
    let script = resource(app, "bootstrap/macos.sh")?;
    let mut command = Command::new("/bin/bash");
    command.arg(script).args(args);
    json_output(run(command, timeout)?)
}

#[tauri::command]
async fn manager_dependencies(app: AppHandle) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || bootstrap(&app, &["--probe"], 15_000))
        .await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn manager_install_dependency(
    app: AppHandle, name: String, consent: bool
) -> Result<Value, String> {
    if !consent { return Err("Explicit approval required".into()); }
    if !DEPENDENCIES.contains(&name.as_str()) { return Err("Unsupported component".into()); }
    tauri::async_runtime::spawn_blocking(move ||
        bootstrap(&app, &["--install", &name, "--approved"], 300_000)
    ).await.map_err(|e| e.to_string())?
}

fn secret_file() -> Result<PathBuf, String> {
    Ok(home()?.join(".cokacremote").join("oauth-approval-key"))
}
fn approval_key() -> Result<String, String> {
    let secret=fs::read_to_string(secret_file()?)
        .map_err(|_| "OAuth approval key is unavailable".to_string())?;
    let value=secret.trim();
    if !(32..=256).contains(&value.len()) ||
       !value.chars().all(|ch| ch.is_ascii_alphanumeric()||ch=='-'||ch=='_') {
        return Err("Approval key format was not verified".into());
    }
    Ok(value.into())
}

#[tauri::command]
fn manager_reveal() -> Result<String, String> { approval_key() }

#[tauri::command]
fn manager_copy(app: AppHandle, kind: String) -> Result<bool, String> {
    let value = match kind.as_str() {
        "key" => approval_key()?,
        "url" => {
            let status=node_script(&app, "platform/mac/status.mjs", &[], 15_000)?;
            let url=status["endpoint"].as_str().unwrap_or("");
            if !status["urlValid"].as_bool().unwrap_or(false) ||
               !url.starts_with("https://") || !url.ends_with(".trycloudflare.com/mcp") ||
               url.chars().any(char::is_whitespace) {
                return Err("The public MCP URL is not verified".into());
            }
            url.into()
        },
        _=>return Err("Copy target not allowlisted".into()),
    };
    app.clipboard().write_text(value)
        .map_err(|e| format!("Clipboard failed: {e}"))?;
    Ok(true)
}

fn preference_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir=app.path().app_config_dir().map_err(|e|e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e|e.to_string())?;
    Ok(dir.join("ui-preferences.json"))
}
#[tauri::command]
fn manager_language(app: AppHandle) -> Result<Value,String> {
    let saved=fs::read_to_string(preference_path(&app)?).ok()
        .and_then(|text|serde_json::from_str::<Value>(&text).ok())
        .and_then(|value|value["language"].as_str().map(str::to_owned))
        .filter(|code|LANGUAGES.contains(&code.as_str()));
    Ok(json!({"selected":saved,"system":sys_locale::get_locale().unwrap_or_else(||"en".into())}))
}
#[tauri::command]
fn manager_set_language(app: AppHandle, code: String) -> Result<Value,String> {
    if !LANGUAGES.contains(&code.as_str()) { return Err("Unsupported language".into()); }
    let path=preference_path(&app)?;
    let temp=path.with_extension(format!("{}.tmp",std::process::id()));
    use std::os::unix::fs::OpenOptionsExt;
    use std::io::Write;
    let mut handle=fs::OpenOptions::new().write(true).create_new(true).mode(0o600)
        .open(&temp).map_err(|e|e.to_string())?;
    handle.write_all(json!({"schema":1,"language":code}).to_string().as_bytes())
        .map_err(|e|e.to_string())?;
    fs::rename(&temp,&path).map_err(|e|e.to_string())?;
    Ok(json!({"language":code}))
}
#[tauri::command]
fn manager_open_chat() -> Result<(),String> {
    open::that("https://chatgpt.com/").map_err(|e|e.to_string())
}
#[tauri::command]
fn manager_minimize(app: AppHandle) -> Result<(),String> {
    app.get_webview_window("main").ok_or("Main window absent")?
        .minimize().map_err(|e|e.to_string())
}
#[tauri::command]
fn manager_close(app: AppHandle) -> Result<(),String> {
    app.get_webview_window("main").ok_or("Main window absent")?
        .close().map_err(|e|e.to_string())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![
            manager_status,manager_operate,manager_dependencies,manager_install_dependency,
            manager_reveal,manager_copy,manager_language,manager_set_language,
            manager_open_chat,manager_minimize,manager_close
        ])
        .run(tauri::generate_context!())
        .expect("Could not start cokacremote desktop manager");
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn strict_action_allowlist() { assert!(ACTIONS.contains(&"setup")); assert!(!ACTIONS.contains(&"shell")); }
    #[test] fn explicit_dependency_allowlist() { assert!(DEPENDENCIES.contains(&"node")); assert!(!DEPENDENCIES.contains(&"password")); }
}
