use url::Url;

#[tauri::command]
pub async fn verify_canvas(url: String, token: String) -> Result<(), String> {
    // Validate URL in Rust — the frontend check is not a security boundary
    // because the Tauri IPC is accessible to any JS running in the webview.
    let parsed = Url::parse(&url).map_err(|_| "Invalid Canvas URL.".to_string())?;

    if parsed.scheme() != "https" {
        return Err("Canvas URL must use https://.".into());
    }
    if parsed.username() != "" || parsed.password().is_some() {
        return Err("Canvas URL must not contain credentials.".into());
    }

    let host = parsed.host_str().unwrap_or("");
    if is_private_host(host) {
        return Err("Canvas URL must be a public hostname, not a private or internal address.".into());
    }

    let clean_url = url.trim_end_matches('/');
    let endpoint = format!("{}/api/v1/courses?per_page=1", clean_url);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .get(&endpoint)
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|_| {
            format!(
                "Couldn't reach {}. Check your Canvas URL and internet connection.",
                clean_url
            )
        })?;

    match resp.status().as_u16() {
        200 => Ok(()),
        401 => Err(
            "Invalid token. Go to Canvas → Account → Settings → Access Tokens and generate a new one.".into(),
        ),
        404 => Err(format!(
            "Couldn't find Canvas at {}. Double-check your school's Canvas address.",
            clean_url
        )),
        status => Err(format!(
            "Canvas returned an unexpected error (HTTP {}). Check your Canvas URL.",
            status
        )),
    }
}

fn is_private_host(host: &str) -> bool {
    let h = host.to_lowercase();

    // Exact matches
    if h == "localhost" || h == "0.0.0.0" || h == "::1" {
        return true;
    }

    // IPv4 private / loopback / link-local ranges
    let ipv4_blocked = ["10.", "127.", "169.254.", "192.168."];
    for prefix in &ipv4_blocked {
        if h.starts_with(prefix) {
            return true;
        }
    }

    // 172.16.0.0/12
    if h.starts_with("172.") {
        let parts: Vec<&str> = h.splitn(4, '.').collect();
        if parts.len() >= 2 {
            if let Ok(second) = parts[1].parse::<u8>() {
                if (16..=31).contains(&second) {
                    return true;
                }
            }
        }
    }

    // IPv6 link-local and unique-local
    if h.starts_with("fe80:") || h.starts_with("fc") || h.starts_with("fd") {
        return true;
    }

    false
}
