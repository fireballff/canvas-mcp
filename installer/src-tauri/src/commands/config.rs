use std::path::{Component, Path, PathBuf};

#[tauri::command]
pub async fn write_config(
    install_path: String,
    canvas_url: String,
    canvas_key: String,
    config_paths: Vec<String>,
) -> Result<(), String> {
    let home = dirs::home_dir().ok_or("Cannot determine home directory.")?;

    #[cfg(target_os = "windows")]
    let node_cmd = format!("{}\\node.exe", install_path);
    #[cfg(not(target_os = "windows"))]
    let node_cmd = format!("{}/node", install_path);

    #[cfg(target_os = "windows")]
    let index_path = format!("{}\\index.js", install_path);
    #[cfg(not(target_os = "windows"))]
    let index_path = format!("{}/index.js", install_path);

    let entry = serde_json::json!({
        "command": node_cmd,
        "args": [index_path],
        "env": {
            "CANVAS_API_URL": canvas_url.trim_end_matches('/'),
            "CANVAS_API_KEY": canvas_key
        }
    });

    for config_path in &config_paths {
        let path = Path::new(config_path);

        // Normalize the path without requiring it to exist yet (can't use canonicalize).
        let abs = if path.is_absolute() {
            path.to_path_buf()
        } else {
            std::env::current_dir()
                .map_err(|e| format!("Cannot get working directory: {}", e))?
                .join(path)
        };
        let normalized = normalize_path(&abs);

        if !normalized.starts_with(&home) {
            return Err(format!(
                "Config path '{}' is outside your home directory — refusing to write.",
                config_path
            ));
        }

        if let Some(parent) = normalized.parent() {
            std::fs::create_dir_all(parent).map_err(|e| {
                format!("Cannot create directory for {}: {}", config_path, e)
            })?;
        }

        let mut existing: serde_json::Value = if normalized.exists() {
            let content = std::fs::read_to_string(&normalized)
                .map_err(|e| format!("Cannot read {}: {}", config_path, e))?;
            serde_json::from_str(&content).unwrap_or(serde_json::json!({}))
        } else {
            serde_json::json!({})
        };

        if existing["mcpServers"].is_null() {
            existing["mcpServers"] = serde_json::json!({});
        }
        existing["mcpServers"]["canvas"] = entry.clone();

        let json = serde_json::to_string_pretty(&existing)
            .map_err(|e| format!("Cannot serialise config: {}", e))?;

        write_private(&normalized, &(json + "\n"))
            .map_err(|e| format!("Cannot write {}: {}", config_path, e))?;
    }

    Ok(())
}

/// Resolve `.` and `..` components without hitting the filesystem.
fn normalize_path(path: &Path) -> PathBuf {
    let mut components: Vec<Component> = Vec::new();
    for component in path.components() {
        match component {
            Component::ParentDir => { components.pop(); }
            Component::CurDir => {}
            c => components.push(c),
        }
    }
    components.iter().collect()
}

/// Write file with owner-only permissions (0o600 on Unix, default on Windows).
fn write_private(path: &Path, contents: &str) -> std::io::Result<()> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        use std::io::Write;
        let mut f = std::fs::OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .mode(0o600)
            .open(path)?;
        f.write_all(contents.as_bytes())
    }
    #[cfg(not(unix))]
    {
        std::fs::write(path, contents)
    }
}
