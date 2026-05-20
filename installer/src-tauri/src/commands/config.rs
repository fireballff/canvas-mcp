use std::path::Path;

#[tauri::command]
pub async fn write_config(
    install_path: String,
    canvas_url: String,
    canvas_key: String,
    config_paths: Vec<String>,
) -> Result<(), String> {
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

        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| {
                format!("Cannot create directory for {}: {}", config_path, e)
            })?;
        }

        let mut existing: serde_json::Value = if path.exists() {
            let content = std::fs::read_to_string(path)
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

        std::fs::write(path, json + "\n")
            .map_err(|e| format!("Cannot write {}: {}", config_path, e))?;
    }

    Ok(())
}
