# Canvas MCP Server — Design Spec
**Date:** 2026-05-20  
**Status:** Approved

## What We're Building

A TypeScript MCP server that lets any AI agent (Claude, ChatGPT, Gemini, OpenRouter clients) query a student's Canvas LMS account for assignments. The server is published to npm so any student can install it in one command and configure it for their AI client of choice.

---

## Architecture

```
canvas-mcp/
├── src/
│   ├── index.ts               # MCP server entry point, registers tools
│   ├── canvas-client.ts       # Thin wrapper around the generated Canvas client
│   ├── setup.ts               # CLI setup wizard (npx canvas-mcp setup)
│   └── tools/
│       ├── assignments.ts     # Tool implementations
│       └── index.ts           # Exports all tools
├── scripts/
│   └── generate.ts            # Regenerates Canvas API client from OpenAPI spec
├── generated/                 # Auto-generated Canvas client (gitignored)
├── .env.example               # CANVAS_API_URL, CANVAS_API_KEY
├── .gitignore                 # Excludes generated/, .env, node_modules/, dist/
└── package.json
```

---

## Canvas API Client

Canvas publishes an official OpenAPI spec. We use `openapi-generator` to auto-generate a fully typed TypeScript client from it. This means:

- We never write raw HTTP calls
- All Canvas endpoints are typed
- When Canvas updates their API, we regenerate and get the changes for free

The `generated/` folder is excluded from git — it's always rebuilt from the spec.

---

## Tools (v1)

### `get_all_assignments_due`
Returns all assignments due across all enrolled courses within a time window.

**Parameters:**
- `hours_ahead` (optional, default: 24) — how far ahead to look in hours

**Returns:** List of assignments with course name, assignment title, due date, points possible, and a direct URL to the assignment.

---

### `get_course_assignments_due`
Returns assignments due for a specific course within a time window.

**Parameters:**
- `course_name` (required) — name or partial name of the course (fuzzy matched)
- `hours_ahead` (optional, default: 24)

**Returns:** Same shape as above, filtered to the matched course.

---

## Multi-Client Support

The server speaks standard MCP protocol — one codebase, works everywhere.

**Installation (any client):**
```bash
npx canvas-mcp
```

**Setup wizard:**
```bash
npx canvas-mcp setup --client claude
npx canvas-mcp setup --client chatgpt
npx canvas-mcp setup --client gemini
npx canvas-mcp setup --client openrouter
```

The setup wizard:
1. Prompts for `CANVAS_API_URL` and `CANVAS_API_KEY`
2. Detects the correct config file path for the chosen client
3. Writes the MCP server entry into that config automatically

**Config file locations:**

| Client | Config Path |
|---|---|
| Claude Code | `~/.claude/claude_mcp_config.json` |
| Gemini | `~/.gemini/settings.json` |
| ChatGPT/OpenAI clients | Varies by client (Cursor, Continue, etc.) |
| OpenRouter clients | Their own MCP config location |

---

## Authentication

Canvas requires:
- `CANVAS_API_URL` — your school's Canvas base URL (e.g. `https://school.instructure.com`)
- `CANVAS_API_KEY` — a personal access token (generated in Canvas: Account → Settings → New Access Token)

Both are stored in a `.env` file locally and never committed to git.

---

## Error Handling

- Invalid/expired API key → clear error message with link to generate a new token
- Course name not found → suggest closest match
- Canvas API down → surface the HTTP error with status code

---

## Future Work (v2)

- `get_all_announcements` — recent announcements across all courses
- `get_course_announcements` — announcements for a specific course
- `get_grades` — current grades per course
- Auto-update check for the generated Canvas client

---

## Out of Scope

- Real-time push notifications (Canvas doesn't support webhooks for students)
- Submitting assignments
- Any write operations to Canvas
