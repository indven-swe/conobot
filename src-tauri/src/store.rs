//! Local persistence.
//!
//! Chats, provider profiles and keys live in a single JSON document inside the
//! OS app-data directory (`app_data_dir/store.json`). Writes go through a temp
//! file so a crash mid-write cannot corrupt the store.

use std::fs;
use std::path::PathBuf;

use tauri::{AppHandle, Manager};

const STORE_FILE: &str = "store.json";
const MAX_STORE_BYTES: usize = 64 * 1024 * 1024;

fn store_path(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Could not resolve the app data directory: {error}"))?;
    fs::create_dir_all(&directory)
        .map_err(|error| format!("Could not create {}: {error}", directory.display()))?;
    Ok(directory.join(STORE_FILE))
}

#[tauri::command]
pub fn load_store(app: AppHandle) -> Result<Option<String>, String> {
    let path = store_path(&app)?;
    match fs::read_to_string(&path) {
        Ok(contents) => Ok(Some(contents)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!("Could not read {}: {error}", path.display())),
    }
}

#[tauri::command]
pub fn save_store(app: AppHandle, payload: String) -> Result<(), String> {
    if payload.len() > MAX_STORE_BYTES {
        return Err("Refusing to write an oversized store file.".into());
    }
    let path = store_path(&app)?;
    let temporary = path.with_extension("json.tmp");

    fs::write(&temporary, payload.as_bytes())
        .map_err(|error| format!("Could not write {}: {error}", temporary.display()))?;

    // `fs::rename` replaces an existing file atomically on every platform we
    // ship to, so a crash can never leave a half-written store behind.
    fs::rename(&temporary, &path).map_err(|error| {
        let _ = fs::remove_file(&temporary);
        format!("Could not finalise {}: {error}", path.display())
    })
}

#[tauri::command]
pub fn write_text_file(path: String, contents: String) -> Result<(), String> {
    if path.trim().is_empty() {
        return Err("No target path was provided.".into());
    }
    let target = PathBuf::from(&path);
    if let Some(parent) = target.parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            return Err(format!("Directory does not exist: {}", parent.display()));
        }
    }
    fs::write(&target, contents)
        .map_err(|error| format!("Could not write {}: {error}", target.display()))
}

#[tauri::command]
pub fn store_location(app: AppHandle) -> Result<String, String> {
    Ok(store_path(&app)?.display().to_string())
}
