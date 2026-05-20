# Privacy Notice

**canvas-mcp does not collect, store, or transmit your data.**

## What happens to your data

canvas-mcp runs entirely on your own machine. When you ask your AI assistant about assignments, the following happens locally:

1. Your AI client calls canvas-mcp running on your computer
2. canvas-mcp calls your school's Canvas API directly (using your API token)
3. Canvas returns your assignment data to canvas-mcp on your machine
4. canvas-mcp passes that data to your AI client

At no point does any of your data pass through servers we operate. There are no analytics, no telemetry, no crash reporting, and no usage tracking of any kind.

## What canvas-mcp can access

canvas-mcp only requests:

- Your enrolled courses (`/api/v1/courses`)
- Assignments for those courses (`/api/v1/courses/:id/assignments`)

It does not access grades, messages, files, submissions, personal profile data, or anything else on Canvas.

## Your Canvas API token

Your Canvas API token is stored locally in your AI client's config file (e.g. `~/.claude/claude_mcp_config.json`). It is never sent anywhere except your school's Canvas API over HTTPS.

You can revoke your token at any time: Canvas → Account → Settings → Approved Integrations.

## Your AI client

When canvas-mcp passes assignment data to your AI client (Claude, ChatGPT, Gemini, etc.), that data is subject to the privacy policy of whichever AI service you use — not ours. Review your AI provider's privacy policy if you have concerns about how they handle data you share with them.

## Contact

Questions? Open an issue at https://github.com/fireballff/canvas-mcp/issues
