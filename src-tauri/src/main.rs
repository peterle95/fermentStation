use base64::{engine::general_purpose::STANDARD, Engine};
use std::{
    fs::{self, File},
    io::Write,
    path::{Component, Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager};

const MAX_SHARED_FILE_BYTES: u64 = 64 * 1024 * 1024;

#[tauri::command]
fn shared_get_location(app: AppHandle) -> Result<Option<String>, String> {
    Ok(configured_root(&app)?.map(|path| path.to_string_lossy().into_owned()))
}

#[tauri::command]
fn shared_choose_location(app: AppHandle) -> Result<Option<String>, String> {
    let Some(path) = rfd::FileDialog::new().set_title("Choose FermentStation shared folder").pick_folder() else {
        return Ok(None);
    };
    let config = config_path(&app)?;
    if let Some(parent) = config.parent() {
        fs::create_dir_all(parent).map_err(message)?;
    }
    atomic_write(&config, path.to_string_lossy().as_bytes())?;
    Ok(Some(path.to_string_lossy().into_owned()))
}

#[tauri::command]
fn shared_list_files(app: AppHandle) -> Result<Vec<String>, String> {
    let root = required_root(&app)?;
    recover_files(&root, &root, 0)?;
    let mut files = Vec::new();
    list_files(&root, &root, &mut files, 0)?;
    files.sort();
    Ok(files)
}

#[tauri::command]
fn shared_read_file(app: AppHandle, path: String) -> Result<Option<String>, String> {
    let target = shared_path(&required_root(&app)?, &path)?;
    if target.metadata().map(|value| value.len()).unwrap_or(0) > MAX_SHARED_FILE_BYTES {
        return Err("Shared file exceeds the 64 MB limit".to_string());
    }
    match fs::read(target) {
        Ok(bytes) => Ok(Some(STANDARD.encode(bytes))),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(message(error)),
    }
}

#[tauri::command]
fn shared_write_file(app: AppHandle, path: String, data: String) -> Result<(), String> {
    let target = shared_path(&required_root(&app)?, &path)?;
    let bytes = STANDARD.decode(data).map_err(message)?;
    if bytes.len() as u64 > MAX_SHARED_FILE_BYTES {
        return Err("Shared file exceeds the 64 MB limit".to_string());
    }
    if fs::read(&target).ok().as_deref() == Some(bytes.as_slice()) {
        return Ok(());
    }
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(message)?;
    }
    atomic_write(&target, &bytes)
}

fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|path| path.join("shared-directory.txt"))
        .map_err(message)
}

fn configured_root(app: &AppHandle) -> Result<Option<PathBuf>, String> {
    match fs::read_to_string(config_path(app)?) {
        Ok(value) if !value.trim().is_empty() => Ok(Some(PathBuf::from(value.trim()))),
        Ok(_) => Ok(None),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(message(error)),
    }
}

fn required_root(app: &AppHandle) -> Result<PathBuf, String> {
    configured_root(app)?.ok_or_else(|| "No shared folder is configured".to_string())
}

fn shared_path(root: &Path, relative: &str) -> Result<PathBuf, String> {
    if relative.is_empty() || relative.contains('\\') {
        return Err("Shared file path is invalid".to_string());
    }
    let path = Path::new(relative);
    if path.components().any(|part| !matches!(part, Component::Normal(_))) {
        return Err("Shared file path must be relative".to_string());
    }
    let root = fs::canonicalize(root).map_err(message)?;
    let target = root.join(path);
    let mut existing = target.as_path();
    while !existing.exists() {
        existing = existing.parent().ok_or("Shared file path is invalid")?;
    }
    let resolved = fs::canonicalize(existing).map_err(message)?;
    if !resolved.starts_with(&root) {
        return Err("Shared file path leaves the selected folder".to_string());
    }
    Ok(target)
}

fn list_files(root: &Path, directory: &Path, output: &mut Vec<String>, depth: usize) -> Result<(), String> {
    if depth > 64 {
        return Err("Shared folder nesting exceeds the supported limit".to_string());
    }
    if !directory.exists() {
        return Ok(());
    }
    for entry in fs::read_dir(directory).map_err(message)? {
        let entry = entry.map_err(message)?;
        let path = entry.path();
        let metadata = fs::symlink_metadata(&path).map_err(message)?;
        if metadata.file_type().is_symlink() {
            continue;
        }
        if metadata.is_dir() {
            let resolved = fs::canonicalize(&path).map_err(message)?;
            if !resolved.starts_with(fs::canonicalize(root).map_err(message)?) {
                continue;
            }
            list_files(root, &path, output, depth + 1)?;
        } else if metadata.is_file() {
            output.push(path.strip_prefix(root).map_err(message)?.to_string_lossy().replace('\\', "/"));
        }
    }
    Ok(())
}

fn recover_files(root: &Path, directory: &Path, depth: usize) -> Result<(), String> {
    if depth > 64 {
        return Err("Shared folder nesting exceeds the supported limit".to_string());
    }
    if !directory.exists() {
        return Ok(());
    }
    let mut entries = fs::read_dir(directory)
        .map_err(message)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(message)?;
    entries.sort_by_key(|entry| std::cmp::Reverse(entry.file_name()));
    for entry in &entries {
        let metadata = fs::symlink_metadata(entry.path()).map_err(message)?;
        if metadata.is_dir() && !metadata.file_type().is_symlink() {
            let allowed = depth > 0 || matches!(entry.file_name().to_str(), Some("records" | "photos" | "migration-backup"));
            if allowed {
                recover_files(root, &entry.path(), depth + 1)?;
            }
        }
    }
    for marker in [".bak-", ".tmp-"] {
        for entry in &entries {
            let path = entry.path();
            let Some(name) = path.file_name().and_then(|value| value.to_str()) else { continue };
            let Some(index) = name.rfind(marker) else { continue };
            let nonce = &name[index + marker.len()..];
            if !name.starts_with('.') || index <= 1 || nonce.is_empty() || !nonce.chars().all(|value| value.is_ascii_digit()) {
                continue;
            }
            let target = path.with_file_name(&name[1..index]);
            if depth == 0 && target.file_name().and_then(|value| value.to_str()) != Some("manifest.json") {
                continue;
            }
            if target.exists() {
                fs::remove_file(&path).map_err(message)?;
            } else {
                fs::rename(&path, target).map_err(message)?;
            }
        }
    }
    let resolved = fs::canonicalize(directory).map_err(message)?;
    if !resolved.starts_with(fs::canonicalize(root).map_err(message)?) {
        return Err("Shared folder contains an unsafe linked directory".to_string());
    }
    Ok(())
}

fn atomic_write(target: &Path, bytes: &[u8]) -> Result<(), String> {
    let name = target.file_name().and_then(|name| name.to_str()).ok_or("Invalid file name")?;
    let nonce = SystemTime::now().duration_since(UNIX_EPOCH).map_err(message)?.as_nanos();
    let temporary = target.with_file_name(format!(".{name}.tmp-{nonce}"));
    let backup = target.with_file_name(format!(".{name}.bak-{nonce}"));
    let mut file = File::create(&temporary).map_err(message)?;
    file.write_all(bytes).map_err(message)?;
    file.sync_all().map_err(message)?;
    drop(file);

    let had_target = target.exists();
    if had_target {
        fs::rename(target, &backup).map_err(message)?;
    }
    if let Err(error) = fs::rename(&temporary, target) {
        if had_target {
            let _ = fs::rename(&backup, target);
        }
        let _ = fs::remove_file(&temporary);
        return Err(message(error));
    }
    if had_target {
        fs::remove_file(backup).map_err(message)?;
    }
    if let Some(parent) = target.parent() {
        if let Ok(directory) = File::open(parent) {
            let _ = directory.sync_all();
        }
    }
    Ok(())
}

fn message(error: impl std::fmt::Display) -> String {
    error.to_string()
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            shared_get_location,
            shared_choose_location,
            shared_list_files,
            shared_read_file,
            shared_write_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running FermentStation");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shared_paths_reject_traversal_and_absolute_paths() {
        let root = std::env::temp_dir();
        assert!(shared_path(&root, "records/batches.json").is_ok());
        assert!(shared_path(&root, "../private.json").is_err());
        assert!(shared_path(&root, "C:/private.json").is_err());
        assert!(shared_path(&root, "records\\private.json").is_err());
    }
}
