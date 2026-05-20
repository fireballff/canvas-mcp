# Canvas MCP Desktop Installer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a cross-platform Tauri v2 desktop app that lets students configure `@fireballff/canvas-mcp` in Claude Code, Cursor, and Codex without touching a terminal.

**Architecture:** A 4-step wizard frontend (React + TypeScript) communicates with a Rust backend via Tauri commands. The Rust backend extracts a bundled Node.js binary + canvas-mcp source to `~/.canvas-mcp/` on first run, writes the MCP config entry to each selected AI client's JSON config file, and verifies the Canvas API connection via a direct HTTP call.

**Tech Stack:** Tauri v2, React 18, TypeScript, Rust, Vitest, `reqwest` (Rust HTTP), `dirs` crate, GitHub Actions

---

## File Structure

**New project at:** `/Users/fireballff/Desktop/claude apps/canvas-mcp-installer/`

```
canvas-mcp-installer/
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs                  — registers all Tauri commands
│   │   ├── commands/
│   │   │   ├── mod.rs              — re-exports all commands
│   │   │   ├── sidecar.rs          — extract_sidecar: copy node + index.js to ~/.canvas-mcp/
│   │   │   ├── config.rs           — write_config: merge MCP entry into client JSON files
│   │   │   └── verify.rs           — verify_canvas: HTTP GET /api/v1/courses
│   │   └── main.rs                 — Tauri entry point (thin)
│   ├── resources/
│   │   └── sidecar/
│   │       ├── node                — Node.js LTS binary (platform-specific, added by CI)
│   │       └── index.js            — canvas-mcp compiled entry (added by build script)
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/
│   ├── main.tsx                    — React entry point
│   ├── App.tsx                     — wizard state machine, step routing
│   ├── types.ts                    — shared TypeScript types
│   ├── lib/
│   │   ├── validate.ts             — validateCanvasUrl (ported from canvas-mcp)
│   │   └── clients.ts              — known clients, config path detection
│   └── components/
│       ├── Step1Url.tsx            — Canvas URL input + validation
│       ├── Step2Token.tsx          — API token input with show/hide
│       ├── Step3Clients.tsx        — client checkboxes with editable path fallback
│       └── Step4Verify.tsx         — progress states + success/error display
├── tests/
│   ├── validate.test.ts
│   └── clients.test.ts
├── scripts/
│   └── fetch-sidecar.js            — downloads Node.js LTS + canvas-mcp dist into resources/
├── package.json
├── vite.config.ts
└── .github/workflows/build.yml
```

---

## Task 1: Bootstrap Tauri v2 project

**Files:**
- Create: `canvas-mcp-installer/` (entire project scaffold)

- [ ] **Step 1: Scaffold the project**

```bash
cd "/Users/fireballff/Desktop/claude apps"
npm create tauri-app@latest canvas-mcp-installer -- --template react-ts --manager npm
cd canvas-mcp-installer
npm install
```

- [ ] **Step 2: Verify dev mode launches**

```bash
npm run tauri dev
```

Expected: A blank window opens with the default Tauri + React template. Close it.

- [ ] **Step 3: Add Rust dependencies**

Edit `src-tauri/Cargo.toml` — replace `[dependencies]` section:

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-build = { version = "2", features = [] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
reqwest = { version = "0.12", features = ["json", "rustls-tls"], default-features = false }
dirs = "5"
tokio = { version = "1", features = ["full"] }
```

- [ ] **Step 4: Create commands directory structure**

```bash
mkdir -p src-tauri/src/commands
touch src-tauri/src/commands/mod.rs
touch src-tauri/src/commands/sidecar.rs
touch src-tauri/src/commands/config.rs
touch src-tauri/src/commands/verify.rs
mkdir -p src-tauri/resources/sidecar
mkdir -p scripts
mkdir -p tests
```

- [ ] **Step 5: Configure resources in tauri.conf.json**

Edit `src-tauri/tauri.conf.json` — add `resources` inside `bundle`:

```json
{
  "bundle": {
    "active": true,
    "targets": "all",
    "resources": {
      "resources/sidecar/node": "sidecar/node",
      "resources/sidecar/node.exe": "sidecar/node.exe",
      "resources/sidecar/index.js": "sidecar/index.js"
    }
  }
}
```

- [ ] **Step 6: Commit**

```bash
git init
printf "node_modules/\ntarget/\ndist/\nsrc-tauri/resources/sidecar/node\nsrc-tauri/resources/sidecar/node.exe\nsrc-tauri/resources/sidecar/index.js\n.tmp-canvas-mcp/\n" > .gitignore
git add -A
git commit -m "feat: bootstrap Tauri v2 canvas-mcp installer project"
```

---

## Task 2: URL validation utility + tests

**Files:**
- Create: `src/lib/validate.ts`
- Create: `tests/validate.test.ts`

- [ ] **Step 1: Write the failing tests**

`tests/validate.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { validateCanvasUrl } from "../src/lib/validate";

describe("validateCanvasUrl", () => {
  it("rejects empty string", () => {
    expect(validateCanvasUrl("")).not.toBeNull();
  });

  it("rejects http://", () => {
    expect(validateCanvasUrl("http://canvas.school.edu")).not.toBeNull();
  });

  it("rejects credential injection https://user@evil.com", () => {
    expect(validateCanvasUrl("https://legitschool.edu@evil.com")).not.toBeNull();
  });

  it("rejects private IP 10.x.x.x", () => {
    expect(validateCanvasUrl("https://10.0.0.1")).not.toBeNull();
  });

  it("rejects localhost", () => {
    expect(validateCanvasUrl("https://127.0.0.1")).not.toBeNull();
  });

  it("accepts a valid https Canvas URL", () => {
    expect(validateCanvasUrl("https://ocean.instructure.com")).toBeNull();
  });

  it("accepts URL with trailing slash", () => {
    expect(validateCanvasUrl("https://canvas.school.edu/")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- tests/validate.test.ts
```

Expected: `FAIL — cannot find module '../src/lib/validate'`

- [ ] **Step 3: Implement validate.ts**

`src/lib/validate.ts`:
```typescript
const PRIVATE_IP_RE =
  /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|169\.254\.|::1$|fc|fd)/i;

export function validateCanvasUrl(raw: string): string | null {
  if (!raw) return "Canvas URL cannot be empty.";
  if (!raw.startsWith("https://"))
    return "Canvas URL must start with https:// (plain http would send your token unencrypted).";
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return "Canvas URL is not a valid URL.";
  }
  if (parsed.username || parsed.password)
    return "Canvas URL must not contain credentials (no user:pass@ in the URL).";
  if (PRIVATE_IP_RE.test(parsed.hostname))
    return "Canvas URL must be a public hostname, not a private/internal IP address.";
  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- tests/validate.test.ts
```

Expected: `PASS — 7 tests passed`

- [ ] **Step 5: Commit**

```bash
git add src/lib/validate.ts tests/validate.test.ts
git commit -m "feat: add URL validation utility with tests"
```

---

## Task 3: Client detection utility + types

**Files:**
- Create: `src/types.ts`
- Create: `src/lib/clients.ts`
- Create: `tests/clients.test.ts`

- [ ] **Step 1: Define shared types**

`src/types.ts`:
```typescript
export interface WizardState {
  step: 1 | 2 | 3 | 4;
  canvasUrl: string;
  canvasToken: string;
  selectedClients: SelectedClient[];
  installPath: string | null;
  error: string | null;
}

export interface SelectedClient {
  id: string;
  label: string;
  configPath: string;
}

export interface ClientDef {
  id: string;
  label: string;
  configSubPath: string; // relative to home dir, e.g. ".claude/claude_mcp_config.json"
}
```

- [ ] **Step 2: Write the failing tests**

`tests/clients.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { KNOWN_CLIENTS, getConfigPath } from "../src/lib/clients";

describe("KNOWN_CLIENTS", () => {
  it("includes Claude Code", () => {
    expect(KNOWN_CLIENTS.find((c) => c.id === "claude")).toBeDefined();
  });

  it("includes Cursor", () => {
    expect(KNOWN_CLIENTS.find((c) => c.id === "cursor")).toBeDefined();
  });

  it("includes Codex", () => {
    expect(KNOWN_CLIENTS.find((c) => c.id === "codex")).toBeDefined();
  });
});

describe("getConfigPath", () => {
  it("builds the correct Claude Code path", () => {
    const path = getConfigPath("/Users/test", "claude");
    expect(path).toBe("/Users/test/.claude/claude_mcp_config.json");
  });

  it("builds the correct Cursor path", () => {
    const path = getConfigPath("/Users/test", "cursor");
    expect(path).toBe("/Users/test/.cursor/mcp.json");
  });

  it("returns null for unknown client id", () => {
    const path = getConfigPath("/Users/test", "unknown");
    expect(path).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npm run test -- tests/clients.test.ts
```

Expected: `FAIL — cannot find module '../src/lib/clients'`

- [ ] **Step 4: Implement clients.ts**

`src/lib/clients.ts`:
```typescript
import type { ClientDef } from "../types";

export const KNOWN_CLIENTS: ClientDef[] = [
  {
    id: "claude",
    label: "Claude Code",
    configSubPath: ".claude/claude_mcp_config.json",
  },
  {
    id: "cursor",
    label: "Cursor",
    configSubPath: ".cursor/mcp.json",
  },
  {
    id: "codex",
    label: "Codex",
    configSubPath: ".codex/config.json",
  },
];

export function getConfigPath(homeDir: string, clientId: string): string | null {
  const client = KNOWN_CLIENTS.find((c) => c.id === clientId);
  if (!client) return null;
  return `${homeDir}/${client.configSubPath}`;
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm run test -- tests/clients.test.ts
```

Expected: `PASS — 5 tests passed`

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/lib/clients.ts tests/clients.test.ts
git commit -m "feat: add client detection utility and shared types"
```

---

## Task 4: Rust — verify_canvas command

**Files:**
- Create: `src-tauri/src/commands/verify.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add stubs so the project compiles**

`src-tauri/src/commands/sidecar.rs`:
```rust
#[tauri::command]
pub async fn extract_sidecar(_app: tauri::AppHandle) -> Result<String, String> {
    Ok(String::new())
}
```

`src-tauri/src/commands/config.rs`:
```rust
#[tauri::command]
pub async fn write_config(
    _install_path: String,
    _canvas_url: String,
    _canvas_key: String,
    _config_paths: Vec<String>,
) -> Result<(), String> {
    Ok(())
}
```

- [ ] **Step 2: Implement verify.rs**

`src-tauri/src/commands/verify.rs`:
```rust
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
```

- [ ] **Step 3: Wire mod.rs and lib.rs**

`src-tauri/src/commands/mod.rs`:
```rust
pub mod config;
pub mod sidecar;
pub mod verify;

pub use config::write_config;
pub use sidecar::extract_sidecar;
pub use verify::verify_canvas;
```

`src-tauri/src/lib.rs`:
```rust
mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            commands::verify_canvas,
            commands::extract_sidecar,
            commands::write_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 4: Verify it compiles**

```bash
npm run tauri build -- --no-bundle
```

Expected: compiles without errors.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/
git commit -m "feat: add verify_canvas Tauri command"
```

---

## Task 5: Rust — extract_sidecar command

**Files:**
- Modify: `src-tauri/src/commands/sidecar.rs`

- [ ] **Step 1: Implement extract_sidecar**

Replace the stub in `src-tauri/src/commands/sidecar.rs`:

```rust
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
```

- [ ] **Step 2: Verify it compiles**

```bash
npm run tauri build -- --no-bundle
```

Expected: compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/commands/sidecar.rs
git commit -m "feat: add extract_sidecar Tauri command"
```

---

## Task 6: Rust — write_config command

**Files:**
- Modify: `src-tauri/src/commands/config.rs`

- [ ] **Step 1: Implement write_config**

Replace the stub in `src-tauri/src/commands/config.rs`:

```rust
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
```

- [ ] **Step 2: Verify it compiles**

```bash
npm run tauri build -- --no-bundle
```

Expected: compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/commands/config.rs
git commit -m "feat: add write_config Tauri command"
```

---

## Task 7: Step 1 UI — Canvas URL

**Files:**
- Create: `src/components/Step1Url.tsx`

- [ ] **Step 1: Implement Step1Url**

`src/components/Step1Url.tsx`:
```tsx
import { useState } from "react";
import { validateCanvasUrl } from "../lib/validate";

interface Props {
  initialValue: string;
  onNext: (url: string) => void;
}

export function Step1Url({ initialValue, onNext }: Props) {
  const [url, setUrl] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);

  function handleBlur() {
    setError(validateCanvasUrl(url.trim()));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validateCanvasUrl(url.trim());
    if (err) { setError(err); return; }
    onNext(url.trim());
  }

  return (
    <div className="step">
      <h2>Step 1 of 4 — Canvas URL</h2>
      <p>Enter your school's Canvas address.</p>
      <form onSubmit={handleSubmit}>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onBlur={handleBlur}
          placeholder="https://yourschool.instructure.com"
          autoFocus
        />
        {error && <p className="error">{error}</p>}
        <details className="hint">
          <summary>Where do I find this?</summary>
          <p>
            This is the web address you use to log in to Canvas — usually{" "}
            <code>https://yourschool.instructure.com</code> or{" "}
            <code>https://canvas.yourschool.edu</code>.
          </p>
        </details>
        <button type="submit" disabled={!url}>Next →</button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Step1Url.tsx
git commit -m "feat: add Step1Url wizard component"
```

---

## Task 8: Step 2 UI — API Token

**Files:**
- Create: `src/components/Step2Token.tsx`

- [ ] **Step 1: Implement Step2Token**

`src/components/Step2Token.tsx`:
```tsx
import { useState } from "react";

interface Props {
  onNext: (token: string) => void;
  onBack: () => void;
}

export function Step2Token({ onNext, onBack }: Props) {
  const [token, setToken] = useState("");
  const [visible, setVisible] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;
    onNext(token.trim());
  }

  return (
    <div className="step">
      <h2>Step 2 of 4 — API Token</h2>
      <p>Generate an access token so Canvas MCP can read your assignments.</p>
      <form onSubmit={handleSubmit}>
        <div className="token-input">
          <input
            type={visible ? "text" : "password"}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste your token here"
            autoFocus
          />
          <button type="button" onClick={() => setVisible((v) => !v)}>
            {visible ? "Hide" : "Show"}
          </button>
        </div>
        <details className="hint">
          <summary>How do I get a token?</summary>
          <ol>
            <li>Log in to Canvas and click your profile picture (top-left).</li>
            <li>Go to <strong>Account → Settings</strong>.</li>
            <li>Scroll to <strong>Approved Integrations</strong>, click <strong>New Access Token</strong>.</li>
            <li>Give it any name and click <strong>Generate Token</strong>.</li>
            <li>Copy the token and paste it here.</li>
          </ol>
        </details>
        <div className="actions">
          <button type="button" onClick={onBack}>← Back</button>
          <button type="submit" disabled={!token.trim()}>Next →</button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Step2Token.tsx
git commit -m "feat: add Step2Token wizard component"
```

---

## Task 9: Step 3 UI — Select clients

**Files:**
- Create: `src/components/Step3Clients.tsx`

- [ ] **Step 1: Install Tauri fs plugin**

```bash
npm install @tauri-apps/plugin-fs
npm run tauri add fs
```

- [ ] **Step 2: Implement Step3Clients**

`src/components/Step3Clients.tsx`:
```tsx
import { useState, useEffect } from "react";
import { homeDir } from "@tauri-apps/api/path";
import { exists } from "@tauri-apps/plugin-fs";
import { KNOWN_CLIENTS } from "../lib/clients";
import type { SelectedClient } from "../types";

interface ClientRow {
  id: string;
  label: string;
  defaultPath: string;
  dirExists: boolean;
  checked: boolean;
  customPath: string;
}

interface Props {
  onNext: (clients: SelectedClient[]) => void;
  onBack: () => void;
}

export function Step3Clients({ onNext, onBack }: Props) {
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [otherChecked, setOtherChecked] = useState(false);
  const [otherPath, setOtherPath] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const home = await homeDir();
      const detected = await Promise.all(
        KNOWN_CLIENTS.map(async (c) => {
          const fullPath = `${home}/${c.configSubPath}`;
          const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
          const dirExists = await exists(dir);
          return { id: c.id, label: c.label, defaultPath: fullPath, dirExists, checked: dirExists, customPath: fullPath };
        })
      );
      setRows(detected);
      setLoading(false);
    })();
  }, []);

  function toggle(id: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, checked: !r.checked } : r)));
  }

  function setPath(id: string, path: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, customPath: path } : r)));
  }

  function handleNext() {
    const selected: SelectedClient[] = rows
      .filter((r) => r.checked)
      .map((r) => ({ id: r.id, label: r.label, configPath: r.customPath }));
    if (otherChecked && otherPath.trim()) {
      selected.push({ id: "other", label: "Other", configPath: otherPath.trim() });
    }
    onNext(selected);
  }

  const anySelected = rows.some((r) => r.checked) || (otherChecked && otherPath.trim() !== "");

  if (loading) return <p>Detecting installed clients…</p>;

  return (
    <div className="step">
      <h2>Step 3 of 4 — Select AI Clients</h2>
      <p>Choose which AI clients to configure.</p>
      <div className="client-list">
        {rows.map((row) => (
          <div key={row.id} className="client-row">
            <label>
              <input type="checkbox" checked={row.checked} onChange={() => toggle(row.id)} />
              <strong>{row.label}</strong>
              {!row.dirExists && <span className="warn"> (directory not found — enter path manually)</span>}
            </label>
            {row.checked && (
              <input
                type="text"
                value={row.customPath}
                onChange={(e) => setPath(row.id, e.target.value)}
                readOnly={row.dirExists}
                placeholder="/path/to/mcp-config.json"
              />
            )}
          </div>
        ))}
        <div className="client-row">
          <label>
            <input type="checkbox" checked={otherChecked} onChange={() => setOtherChecked((v) => !v)} />
            <strong>Other</strong>
          </label>
          {otherChecked && (
            <input
              type="text"
              value={otherPath}
              onChange={(e) => setOtherPath(e.target.value)}
              placeholder="/path/to/your-client/mcp-config.json"
            />
          )}
        </div>
      </div>
      <div className="actions">
        <button type="button" onClick={onBack}>← Back</button>
        <button onClick={handleNext} disabled={!anySelected}>Configure →</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Step3Clients.tsx
git commit -m "feat: add Step3Clients wizard component with editable path fallback"
```

---

## Task 10: Step 4 UI — Verify & Configure

**Files:**
- Create: `src/components/Step4Verify.tsx`

- [ ] **Step 1: Implement Step4Verify**

`src/components/Step4Verify.tsx`:
```tsx
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { SelectedClient } from "../types";

type Phase = "extracting" | "writing" | "verifying" | "done" | "error";

interface Props {
  canvasUrl: string;
  canvasToken: string;
  selectedClients: SelectedClient[];
  onBack: () => void;
}

export function Step4Verify({ canvasUrl, canvasToken, selectedClients, onBack }: Props) {
  const [phase, setPhase] = useState<Phase>("extracting");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { run(); }, []);

  async function run() {
    try {
      setPhase("extracting");
      const installPath = await invoke<string>("extract_sidecar");

      setPhase("writing");
      await invoke("write_config", {
        installPath,
        canvasUrl,
        canvasKey: canvasToken,
        configPaths: selectedClients.map((c) => c.configPath),
      });

      setPhase("verifying");
      await invoke("verify_canvas", { url: canvasUrl, token: canvasToken });

      setPhase("done");
    } catch (e) {
      setError(String(e));
      setPhase("error");
    }
  }

  const labels: Record<Phase, string> = {
    extracting: "Copying canvas-mcp to your system…",
    writing: "Writing config files…",
    verifying: "Testing your Canvas connection…",
    done: "",
    error: "",
  };

  if (phase === "done") {
    return (
      <div className="step step-done">
        <div className="success-icon">✓</div>
        <h2>All done!</h2>
        <p>Restart {selectedClients.map((c) => c.label).join(", ")} to load Canvas tools.</p>
        <p className="hint">Try asking: "What assignments do I have due in the next 24 hours?"</p>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="step step-error">
        <h2>Something went wrong</h2>
        <p className="error">{error}</p>
        <button onClick={onBack}>← Go back and fix</button>
      </div>
    );
  }

  return (
    <div className="step step-loading">
      <h2>Step 4 of 4 — Configuring…</h2>
      <div className="spinner" />
      <p>{labels[phase]}</p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Step4Verify.tsx
git commit -m "feat: add Step4Verify wizard component"
```

---

## Task 11: App shell + wizard state machine

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Implement App.tsx**

`src/App.tsx`:
```tsx
import { useState } from "react";
import { Step1Url } from "./components/Step1Url";
import { Step2Token } from "./components/Step2Token";
import { Step3Clients } from "./components/Step3Clients";
import { Step4Verify } from "./components/Step4Verify";
import type { WizardState } from "./types";

const INITIAL: WizardState = {
  step: 1,
  canvasUrl: "",
  canvasToken: "",
  selectedClients: [],
  installPath: null,
  error: null,
};

export default function App() {
  const [state, setState] = useState<WizardState>(INITIAL);

  function patch(updates: Partial<WizardState>) {
    setState((prev) => ({ ...prev, ...updates }));
  }

  switch (state.step) {
    case 1:
      return (
        <Step1Url
          initialValue={state.canvasUrl}
          onNext={(url) => patch({ canvasUrl: url, step: 2 })}
        />
      );
    case 2:
      return (
        <Step2Token
          onNext={(token) => patch({ canvasToken: token, step: 3 })}
          onBack={() => patch({ step: 1 })}
        />
      );
    case 3:
      return (
        <Step3Clients
          onNext={(clients) => patch({ selectedClients: clients, step: 4 })}
          onBack={() => patch({ step: 2 })}
        />
      );
    case 4:
      return (
        <Step4Verify
          canvasUrl={state.canvasUrl}
          canvasToken={state.canvasToken}
          selectedClients={state.selectedClients}
          onBack={() => patch({ step: 3 })}
        />
      );
  }
}
```

- [ ] **Step 2: Verify the app runs end-to-end in dev mode**

```bash
npm run tauri dev
```

Expected: wizard opens at step 1. Navigate through all 4 steps. Step 4 will error because resources aren't present yet — verify the error screen renders cleanly with a "Go back" button.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire wizard steps into App shell"
```

---

## Task 12: Bundle Node.js + canvas-mcp sidecar resources

**Files:**
- Create: `scripts/fetch-sidecar.js`
- Modify: `package.json`

- [ ] **Step 1: Write the fetch-sidecar script**

`scripts/fetch-sidecar.js`:
```js
#!/usr/bin/env node
/**
 * Downloads Node.js LTS for the current platform and extracts canvas-mcp's
 * dist/index.js into src-tauri/resources/sidecar/.
 *
 * Uses execFileSync (not exec/execSync with strings) to avoid shell injection.
 * All arguments are passed as arrays, never interpolated into a shell string.
 */
import { execFileSync } from "child_process";
import { existsSync, mkdirSync, cpSync, rmSync, createWriteStream } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import https from "https";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SIDECAR_DIR = join(ROOT, "src-tauri", "resources", "sidecar");
const TMP = join(ROOT, ".tmp-canvas-mcp");
const NODE_VERSION = "v22.13.1"; // Node.js LTS — update as needed

mkdirSync(SIDECAR_DIR, { recursive: true });
mkdirSync(TMP, { recursive: true });

// --- canvas-mcp index.js ---
console.log("Fetching @fireballff/canvas-mcp...");
execFileSync("npm", ["pack", "@fireballff/canvas-mcp", "--pack-destination", TMP], { stdio: "inherit" });

const tarball = execFileSync("ls", [TMP]).toString().trim();
execFileSync("tar", ["-xzf", join(TMP, tarball), "-C", TMP], { stdio: "inherit" });

const distIndex = join(TMP, "package", "dist", "index.js");
if (!existsSync(distIndex)) {
  throw new Error(`Expected ${distIndex} — check canvas-mcp package structure`);
}
cpSync(distIndex, join(SIDECAR_DIR, "index.js"));
rmSync(TMP, { recursive: true });
console.log("✓ index.js copied");

// --- Node.js binary ---
const platform = process.platform;
const arch = process.arch === "arm64" ? "arm64" : "x64";

let nodePkg, extractedBinPath;
if (platform === "darwin") {
  nodePkg = `node-${NODE_VERSION}-darwin-${arch}.tar.gz`;
  extractedBinPath = join(SIDECAR_DIR, `node-${NODE_VERSION}-darwin-${arch}`, "bin", "node");
} else if (platform === "win32") {
  nodePkg = `node-${NODE_VERSION}-win-${arch}.zip`;
  extractedBinPath = join(SIDECAR_DIR, `node-${NODE_VERSION}-win-${arch}`, "node.exe");
} else {
  throw new Error(`Unsupported platform: ${platform}`);
}

const nodeUrl = `https://nodejs.org/dist/${NODE_VERSION}/${nodePkg}`;
const nodeOut = join(SIDECAR_DIR, nodePkg);

console.log(`Downloading Node.js ${NODE_VERSION} for ${platform}-${arch}...`);
await download(nodeUrl, nodeOut);
console.log("✓ Node.js downloaded");

if (platform === "darwin") {
  execFileSync("tar", ["-xzf", nodeOut, "-C", SIDECAR_DIR], { stdio: "inherit" });
  cpSync(extractedBinPath, join(SIDECAR_DIR, "node"));
  rmSync(nodeOut);
  rmSync(join(SIDECAR_DIR, `node-${NODE_VERSION}-darwin-${arch}`), { recursive: true });
} else {
  const zipEntry = `node-${NODE_VERSION}-win-${arch}/node.exe`;
  execFileSync("unzip", ["-o", nodeOut, zipEntry, "-d", SIDECAR_DIR], { stdio: "inherit" });
  cpSync(extractedBinPath, join(SIDECAR_DIR, "node.exe"));
  rmSync(nodeOut);
  rmSync(join(SIDECAR_DIR, `node-${NODE_VERSION}-win-${arch}`), { recursive: true });
}

console.log("✓ node binary ready at src-tauri/resources/sidecar/");

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        file.close();
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      res.pipe(file);
      file.on("finish", () => file.close(resolve));
    }).on("error", reject);
  });
}
```

- [ ] **Step 2: Add script + ESM flag to package.json**

Edit `package.json` — add `"type": "module"` at the top level and add to `scripts`:
```json
"prepare:sidecar": "node scripts/fetch-sidecar.js"
```

- [ ] **Step 3: Run the script and verify output**

```bash
npm run prepare:sidecar
ls src-tauri/resources/sidecar/
```

Expected output from `ls`: `index.js` and `node` (or `node.exe` on Windows).

- [ ] **Step 4: Do a full build**

```bash
npm run tauri build
```

Expected: builds successfully. Check `src-tauri/target/release/bundle/` for the `.dmg` (Mac) or `.exe` (Windows).

- [ ] **Step 5: Commit**

```bash
git add scripts/fetch-sidecar.js package.json
# node binary and index.js are in .gitignore — do not add them
git commit -m "feat: add fetch-sidecar script to bundle Node.js + canvas-mcp"
```

---

## Task 13: GitHub Actions CI — build Mac + Windows

**Files:**
- Create: `.github/workflows/build.yml`

- [ ] **Step 1: Write the workflow**

`.github/workflows/build.yml`:
```yaml
name: Build

on:
  push:
    tags:
      - "v*"
  workflow_dispatch:

jobs:
  build:
    strategy:
      matrix:
        include:
          - os: macos-latest
            target: aarch64-apple-darwin
          - os: macos-13
            target: x86_64-apple-darwin
          - os: windows-latest
            target: x86_64-pc-windows-msvc

    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.target }}

      - name: Install frontend deps
        run: npm ci

      - name: Fetch sidecar (Node.js + canvas-mcp)
        run: npm run prepare:sidecar

      - name: Build Tauri app
        run: npm run tauri build -- --target ${{ matrix.target }}

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: installer-${{ matrix.target }}
          path: |
            src-tauri/target/${{ matrix.target }}/release/bundle/dmg/*.dmg
            src-tauri/target/${{ matrix.target }}/release/bundle/nsis/*.exe
```

- [ ] **Step 2: Push to GitHub and trigger a build**

```bash
git add .github/
git commit -m "ci: add GitHub Actions build for Mac + Windows"
git remote add origin https://github.com/fireballff/canvas-mcp-installer.git
git push -u origin main
git tag v1.0.0
git push origin v1.0.0
```

Expected: GitHub Actions runs all three matrix jobs. `.dmg` artifacts appear for both Mac architectures; `.exe` for Windows.

---

## Self-Review

- **All 4 wizard steps** implemented with full component code ✓
- **Connection verification** via `verify_canvas` Rust command ✓
- **Node.js sidecar extraction** via `extract_sidecar` ✓
- **Config writing** with JSON merge via `write_config` ✓
- **Editable path fallback** + Other client in Step3Clients ✓
- **Claude Code + Cursor + Codex** in `KNOWN_CLIENTS` ✓
- **Mac + Windows CI** in GitHub Actions ✓
- **No `exec`/`execSync` with string interpolation** — all shell calls use `execFileSync` with array args ✓
- **Codex config path** set to `~/.codex/config.json` — update `clients.ts:KNOWN_CLIENTS` if the real path differs
- **`SelectedClient` type** defined in `types.ts` Task 3, used identically in all components and App.tsx ✓
