#[tauri::command]
pub async fn verify_canvas(url: String, token: String) -> Result<(), String> {
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
        .map_err(|e| {
            format!(
                "Couldn't reach {}. Check your Canvas URL and internet connection. ({})",
                clean_url, e
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
