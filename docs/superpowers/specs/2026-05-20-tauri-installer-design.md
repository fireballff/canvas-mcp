# Canvas MCP Desktop Installer — Design Spec
Date: 2026-05-20

## Goal

A cross-platform desktop app that lets non-technical students configure `@fireballff/canvas-mcp` in their AI client without touching a terminal. Produces a Mac `.dmg` and Windows `.exe`.

## Architecture

Three layers:

1. **Tauri v2 Rust backend** — writes MCP config files to each selected client's path, makes the Canvas API verification call directly (HTTP GET to `/api/v1/courses`), copies the Node.js sidecar out of the app bundle on first run.
2. **React + TypeScript frontend** — 4-step wizard, communicates with the backend via Tauri `invoke()` commands.
3. **Node.js LTS sidecar** — bundled inside the app at `Resources/sidecar/`. On first run, copied to `~/.canvas-mcp/` (Mac) / `%APPDATA%\canvas-mcp\` (Windows). This is what AI clients invoke at runtime via the written config.

Installer size: ~80 MB (Node.js LTS binary + canvas-mcp source).

## Wizard Flow

**Step 1 — Canvas URL**
- Text input, validated on blur
- Rules: must start with `https://`, no embedded credentials, no private IPs, must parse as a valid URL
- Inline error message on failure; "Where do I find this?" tooltip with screenshot

**Step 2 — API Token**
- Password input with show/hide toggle
- Inline collapsible guide: Canvas → Account → Settings → New Access Token
- No validation at this step (deferred to step 4 connection test)

**Step 3 — Select AI Clients**
- Three checkboxes: Claude Code, Cursor, Codex
- Each shows the exact config file path it will write to
- At least one must be selected to proceed
- If a client's config directory doesn't exist, the path field becomes editable — student can paste the correct path manually
- "Other" option with a free-form path input for any unlisted client

**Step 4 — Verify & Configure**
Progress sequence (no manual trigger — runs automatically on entering step 4):
1. "Copying canvas-mcp to your system..." — extracts sidecar to `~/.canvas-mcp/`
2. "Writing config files..." — writes MCP entry to each selected client's JSON
3. "Testing your Canvas connection..." — `GET /api/v1/courses` with the provided credentials

**Success:** green checkmark, "All done! Restart [client names] to load Canvas tools." with a suggested test prompt.

**Failure:** specific error message (see Error Handling), "Go back and fix" button — student stays in the wizard.

## Config Written

Each selected client receives an entry in its MCP config file:

```json
{
  "mcpServers": {
    "canvas": {
      "command": "/Users/<user>/.canvas-mcp/node",
      "args": ["/Users/<user>/.canvas-mcp/index.js"],
      "env": {
        "CANVAS_API_URL": "<entered url>",
        "CANVAS_API_KEY": "<entered token>"
      }
    }
  }
}
```

Config paths:
- **Claude Code:** `~/.claude/claude_mcp_config.json`
- **Cursor:** `~/.cursor/mcp.json`
- **Codex:** TBD — research during implementation (likely `~/.codex/config.json` or similar; show warning if directory not found)

## Error Handling

All errors are recoverable — student stays in wizard and can fix without restarting.

| Error | Message shown |
|---|---|
| Bad Canvas URL | Inline at step 1 with specific reason |
| 401 from Canvas API | "Invalid token. Go to Canvas → Account → Settings → Access Tokens and generate a new one." |
| 404 / connection refused | "Couldn't reach [url]. Double-check your school's Canvas address." |
| Config path not writable | "Couldn't write to [path]. Check your file permissions." |
| Client dir not found | Path field becomes editable — student pastes the correct path; validated to be an absolute path ending in `.json` before proceeding |

## Build & Distribution

- **Mac:** `.dmg` via Tauri's built-in bundler. Requires Apple Developer account + notarization to avoid Gatekeeper warnings.
- **Windows:** `.exe` (NSIS installer) via Tauri bundler. Code signing recommended but not blocking for v1.
- **CI:** GitHub Actions — build both targets on push to `main`, attach to GitHub Release.

## Constraints & Known Limitations

- **No auto-update in v1.** Students re-download the app to get a newer canvas-mcp version. An update mechanism can be added in v2.
- **Codex CLI config path** must be confirmed during implementation — the spec above is a best guess.
- **macOS notarization** is skipped for v1. Students get a one-time Gatekeeper prompt — the README will instruct them to go to System Settings → Privacy & Security → "Allow Anyway."
- **Windows UAC:** writing to `%APPDATA%` does not require elevation, so no UAC prompt expected.
