<div align="center">

# canvas-mcp

**Ask your AI about Canvas assignments — in plain English.**

[![npm](https://img.shields.io/npm/v/@fireballff/canvas-mcp?color=cb3837&label=npm)](https://www.npmjs.com/package/@fireballff/canvas-mcp)
[![Build](https://img.shields.io/github/actions/workflow/status/fireballff/canvas-mcp/build-installer.yml?label=installer%20build)](https://github.com/fireballff/canvas-mcp/actions/workflows/build-installer.yml)
[![License](https://img.shields.io/github/license/fireballff/canvas-mcp)](LICENSE)

Works with Claude, ChatGPT, Gemini, and more.

</div>

---

## Download

The desktop installer bundles everything — no Node.js or terminal needed.

| Platform | Download |
|---|---|
| **Mac** (Apple Silicon) | [canvas-mcp-installer_0.1.0_aarch64.dmg](https://github.com/fireballff/canvas-mcp/releases/download/v1.0.0/canvas-mcp-installer_0.1.0_aarch64.dmg) |
| **Windows** | [canvas-mcp-installer_0.1.0_x64-setup.exe](https://github.com/fireballff/canvas-mcp/releases/download/v1.0.0/canvas-mcp-installer_0.1.0_x64-setup.exe) |

> **Mac:** right-click the app → Open on first launch (one-time Gatekeeper bypass)  
> **Windows:** if SmartScreen appears, click **More info → Run anyway**

---

## Setup (3 steps)

### 1. Find your Canvas URL

Log in to Canvas and copy the base URL from your browser — it looks like one of these:

```
https://university.instructure.com
https://canvas.school.edu
https://yourschool.edu/canvas
```

> Copy everything up to (but not including) `/courses` or `/dashboard`.

### 2. Get your Canvas API token

Canvas → **Account** → **Settings** → scroll to Approved Integrations → **+ New Access Token**

### 3. Run the installer

The installer will ask for your Canvas URL and token, then configure your AI client automatically.

---

## Or set up via terminal

```bash
npx -y @fireballff/canvas-mcp setup --client claude      # Claude Code
npx -y @fireballff/canvas-mcp setup --client chatgpt     # Cursor / OpenAI
npx -y @fireballff/canvas-mcp setup --client gemini      # Gemini CLI
npx -y @fireballff/canvas-mcp setup --client openrouter  # Cline / OpenRouter
```

Then restart your AI client and ask:

> "What assignments do I have due today?"  
> "What's due in Physics in the next 48 hours?"

---

## Tools

<details>
<summary><strong>get_all_assignments_due</strong> — all courses</summary>

Returns assignments due across all your enrolled courses.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `hours_ahead` | number | 24 | How far ahead to look |

**Try:** "What's due today?" · "Any assignments due in the next 3 hours?"

</details>

<details>
<summary><strong>get_course_assignments_due</strong> — one course</summary>

Returns assignments due for a specific course.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `course_name` | string | required | Course name or code (partial match ok) |
| `hours_ahead` | number | 24 | How far ahead to look |

**Try:** "What's due in Physics this week?" · "Any MATH201 assignments due soon?"

</details>

---

## Manual config

<details>
<summary>Add to your MCP config file directly</summary>

```json
{
  "mcpServers": {
    "canvas": {
      "command": "npx",
      "args": ["-y", "@fireballff/canvas-mcp"],
      "env": {
        "CANVAS_API_URL": "https://yourschool.instructure.com",
        "CANVAS_API_KEY": "your-token-here"
      }
    }
  }
}
```

| Client | Config file |
|---|---|
| Claude Code | `~/.claude/claude_mcp_config.json` |
| Gemini CLI | `~/.gemini/settings.json` |
| Cursor | `~/.cursor/mcp.json` |
| Cline | `~/.cline/mcp_settings.json` |

</details>

---

## Contributing

Contributions welcome! Planned for v2:
- Announcements — `get_all_announcements`, `get_course_announcements`
- Grades
- More AI client integrations

```bash
git clone https://github.com/fireballff/canvas-mcp
cd canvas-mcp
npm install
cp .env.example .env   # add your Canvas credentials
npm test
```

## License

MIT
