# canvas-mcp

Query your Canvas LMS assignments from any AI agent — Claude, ChatGPT, Gemini, OpenRouter.

## Quick Start

### 1. Get your Canvas API token
Canvas → Account → Settings → **New Access Token**

### 2. Configure your AI client

```bash
npx -y canvas-mcp setup --client claude      # Claude Code
npx -y canvas-mcp setup --client chatgpt     # Cursor / OpenAI clients
npx -y canvas-mcp setup --client gemini      # Gemini CLI
npx -y canvas-mcp setup --client openrouter  # Cline / Open Router
```

### 3. Restart your AI client and ask away

> "What assignments do I have due today?"  
> "What's due in Physics in the next 48 hours?"

---

## Manual Config

Add to your MCP config file manually:

```json
{
  "mcpServers": {
    "canvas": {
      "command": "npx",
      "args": ["-y", "canvas-mcp"],
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

---

## Tools

### `get_all_assignments_due`
Returns all assignments due across all your enrolled courses.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `hours_ahead` | number | 24 | How far ahead to look |

**Example prompts:**
- "What's due today?"
- "Any assignments due in the next 3 hours?"

---

### `get_course_assignments_due`
Returns assignments due for a specific course.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `course_name` | string | required | Course name or code (partial match ok) |
| `hours_ahead` | number | 24 | How far ahead to look |

**Example prompts:**
- "What's due in Physics this week?"
- "Any MATH201 assignments due soon?"

---

## Contributing

Contributions welcome! Planned for v2:
- Announcements tools (`get_all_announcements`, `get_course_announcements`)
- Grades tool
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
