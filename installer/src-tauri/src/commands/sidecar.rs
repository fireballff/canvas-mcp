use tauri::Manager;

#[tauri::command]
pub async fn extract_sidecar(app: tauri::AppHandle) -> Result<String, String> {
    let home = dirs::home_dir().ok_or("Could not determine home directory.")?;
    let dest = home.join(".canvas-mcp");
    std::fs::create_dir_all(&dest)
        .map_err(|e| format!("Could not create ~/.canvas-mcp: {}", e))?;

    let res_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("Could not locate app resources: {}", e))?;

    #[cfg(target_os = "windows")]
    let node_filename = "node.exe";
    #[cfg(not(target_os = "windows"))]
    let node_filename = "node";

    let node_src = res_dir.join("sidecar").join(node_filename);
    let node_dest = dest.join(node_filename);
    std::fs::copy(&node_src, &node_dest)
        .map_err(|e| format!("Failed to copy Node.js binary: {}", e))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&node_dest, std::fs::Permissions::from_mode(0o755))
            .map_err(|e| format!("Failed to set node permissions: {}", e))?;
    }

    let index_src = res_dir.join("sidecar").join("index.js");
    let index_dest = dest.join("index.js");
    std::fs::copy(&index_src, &index_dest)
        .map_err(|e| format!("Failed to copy canvas-mcp index.js: {}", e))?;

    Ok(dest.to_string_lossy().to_string())
}
