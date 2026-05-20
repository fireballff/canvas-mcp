<div align="center">

# canvas-mcp

**Ask your AI about Canvas assignments — in plain English.**

[![npm](https://img.shields.io/npm/v/@fireballff/canvas-mcp?color=cb3837&label=npm)](https://www.npmjs.com/package/@fireballff/canvas-mcp)
[![Build](https://img.shields.io/github/actions/workflow/status/fireballff/canvas-mcp/build-installer.yml?label=installer%20build)](https://github.com/fireballff/canvas-mcp/actions/workflows/build-installer.yml)
[![License](https://img.shields.io/github/license/fireballff/canvas-mcp)](LICENSE)

Query assignments, grades, announcements, syllabi, and more — works with Claude, ChatGPT, Gemini, and any MCP-compatible AI.

</div>

---

## Download

The desktop installer bundles everything — no Node.js or terminal needed.

| Platform | Download |
|---|---|
| **Mac** (Apple Silicon) | [canvas-mcp-installer_0.1.0_aarch64.dmg](https://github.com/fireballff/canvas-mcp/releases/download/v2.0.1/canvas-mcp-installer_0.1.0_aarch64.dmg) |
| **Windows** (EXE) | [canvas-mcp-installer_0.1.0_x64-setup.exe](https://github.com/fireballff/canvas-mcp/releases/download/v2.0.1/canvas-mcp-installer_0.1.0_x64-setup.exe) |
| **Windows** (MSI) | [canvas-mcp-installer_0.1.0_x64_en-US.msi](https://github.com/fireballff/canvas-mcp/releases/download/v2.0.1/canvas-mcp-installer_0.1.0_x64_en-US.msi) |

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
<summary><strong>list_courses</strong></summary>

List all courses you're currently enrolled in.

**Try:** "What classes am I taking?" · "Show me my courses."

</details>

<details>
<summary><strong>get_all_assignments_due</strong> · <strong>get_course_assignments_due</strong></summary>

Assignments due across all courses, or for one specific course.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `hours_ahead` | number | 24 | How far ahead to look |
| `course_name` | string | — | Required for the single-course version |

**Try:** "What's due today?" · "What's due in Physics this week?"

</details>

<details>
<summary><strong>get_grades</strong> · <strong>get_course_grade</strong></summary>

Current grades across all courses, or for one specific course.

**Try:** "What are my grades?" · "What's my grade in Calc?"

</details>

<details>
<summary><strong>get_missing_assignments</strong></summary>

All assignments that are past due and not submitted.

**Try:** "What am I missing?" · "What haven't I turned in?"

</details>

<details>
<summary><strong>get_submission</strong></summary>

Your score, grade, and instructor comments for a specific assignment.

| Parameter | Type | Description |
|---|---|---|
| `course_name` | string | Course name or partial match |
| `assignment_name` | string | Assignment name or partial match |

**Try:** "What did I get on the Physics midterm?" · "Any feedback on my essay?"

</details>

<details>
<summary><strong>get_announcements</strong> · <strong>get_course_announcements</strong></summary>

Recent announcements from all courses, or one specific course.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `days_back` | number | 7 | How far back to look |
| `course_name` | string | — | Required for the single-course version |

**Try:** "Any new announcements?" · "What did my Bio professor post this week?"

</details>

<details>
<summary><strong>get_upcoming_events</strong></summary>

Calendar events (exams, office hours, course events) from all courses.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `days_ahead` | number | 14 | How far ahead to look |

**Try:** "Any exams coming up?" · "What events do I have this week?"

</details>

<details>
<summary><strong>get_course_syllabus</strong></summary>

The full syllabus for a specific course — great for asking about policies.

| Parameter | Type | Description |
|---|---|---|
| `course_name` | string | Course name or partial match |

**Try:** "What's the late policy in Bio?" · "How is my Physics grade calculated?"

</details>

<details>
<summary><strong>get_course_modules</strong></summary>

The module/topic structure for a specific course.

| Parameter | Type | Description |
|---|---|---|
| `course_name` | string | Course name or partial match |

**Try:** "What topics are covered in Calc?" · "What's coming up in week 4?"

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

## Privacy

canvas-mcp runs entirely on your machine. Your Canvas data goes directly from your school's Canvas to your AI client — it never touches any server we operate. There is no analytics, telemetry, or data collection of any kind.

See [PRIVACY.md](PRIVACY.md) for full details.

---

## Contributing

Contributions welcome!

```bash
git clone https://github.com/fireballff/canvas-mcp
cd canvas-mcp
npm install
cp .env.example .env   # add your Canvas credentials
npm test
```

## License

MIT
