# Canvas MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a TypeScript MCP server that exposes two Canvas LMS assignment tools, installable via `npx canvas-mcp` and auto-configurable for Claude, ChatGPT, Gemini, and OpenRouter clients.

**Architecture:** An MCP server (`@modelcontextprotocol/sdk`) registers two tools backed by a typed Canvas API client that uses native `fetch` with hand-written TypeScript interfaces matching Canvas's REST API shape. A CLI entry point (`commander`) handles both server mode (default) and a setup wizard (`canvas-mcp setup --client <name>`) that writes the MCP config into the user's AI client config file automatically.

**Tech Stack:** TypeScript 5, `@modelcontextprotocol/sdk ^1.12`, `commander ^12`, `dotenv ^16`, `vitest ^2`, `tsx ^4` (dev), Node 18+

---

## File Map

| File | Responsibility |
|---|---|
| `src/types.ts` | Canvas API response shapes + tool output shape |
| `src/canvas-client.ts` | Typed fetch wrapper for Canvas REST API with pagination |
| `src/tools/assignments.ts` | `getAllAssignmentsDue` and `getCourseAssignmentsDue` logic |
| `src/tools/index.ts` | MCP tool definitions + `handleToolCall` dispatcher |
| `src/server.ts` | MCP server wiring (`Server`, `StdioServerTransport`) |
| `src/setup.ts` | Setup wizard — prompts for credentials, writes client config |
| `src/index.ts` | CLI entry point — routes `serve` (default) vs `setup` |
| `tests/assignments.test.ts` | Unit tests for assignment filtering and course matching |
| `tests/canvas-client.test.ts` | Unit tests for pagination and error handling |

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.env.example`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "canvas-mcp",
  "version": "1.0.0",
  "description": "MCP server for Canvas LMS — query assignments from Claude, ChatGPT, Gemini, and OpenRouter agents",
  "type": "module",
  "bin": {
    "canvas-mcp": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "test": "vitest run",
    "prepublishOnly": "npm run build && npm test"
  },
  "keywords": ["mcp", "canvas", "lms", "assignments", "claude", "chatgpt", "gemini"],
  "license": "MIT",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.0",
    "commander": "^12.0.0",
    "dotenv": "^16.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0",
    "vitest": "^2.0.0"
  },
  "engines": {
    "node": ">=18"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Create `.env.example`**

```
CANVAS_API_URL=https://yourschool.instructure.com
CANVAS_API_KEY=your_canvas_api_token_here
```

- [ ] **Step 4: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json .env.example
git commit -m "feat: project scaffold"
```

---

## Task 2: Type Definitions

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Write `src/types.ts`**

```typescript
export interface CanvasCourse {
  id: number;
  name: string;
  course_code: string;
}

export interface CanvasAssignment {
  id: number;
  name: string;
  due_at: string | null;
  points_possible: number;
  html_url: string;
  course_id: number;
}

export interface AssignmentResult {
  courseName: string;
  courseCode: string;
  assignmentName: string;
  dueAt: string;
  pointsPossible: number;
  url: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: Canvas API type definitions"
```

---

## Task 3: Canvas HTTP Client

**Files:**
- Create: `src/canvas-client.ts`
- Create: `tests/canvas-client.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/canvas-client.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";

// Set env before importing the module
process.env.CANVAS_API_URL = "https://test.instructure.com";
process.env.CANVAS_API_KEY = "test-key";

const { CanvasClient } = await import("../src/canvas-client.js");

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CanvasClient", () => {
  it("throws if env vars are missing", async () => {
    const originalUrl = process.env.CANVAS_API_URL;
    delete process.env.CANVAS_API_URL;
    expect(() => new CanvasClient()).toThrow("CANVAS_API_URL");
    process.env.CANVAS_API_URL = originalUrl;
  });

  it("fetches a single page of courses", async () => {
    const mockCourses = [
      { id: 1, name: "Physics 101", course_code: "PHYS101" },
    ];
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockCourses), { status: 200, headers: {} })
    );

    const client = new CanvasClient();
    const courses = await client.getCourses();
    expect(courses).toEqual(mockCourses);
  });

  it("follows pagination Link headers", async () => {
    const page1 = [{ id: 1, name: "Physics 101", course_code: "PHYS101" }];
    const page2 = [{ id: 2, name: "Calculus II", course_code: "MATH201" }];

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify(page1), {
          status: 200,
          headers: { link: '<https://test.instructure.com/api/v1/courses?page=2>; rel="next"' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(page2), { status: 200, headers: {} })
      );

    const client = new CanvasClient();
    const courses = await client.getCourses();
    expect(courses).toHaveLength(2);
  });

  it("throws a readable error on non-200 response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Unauthorized", { status: 401 })
    );
    const client = new CanvasClient();
    await expect(client.getCourses()).rejects.toThrow("Canvas API error 401");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/canvas-client.test.ts
```

Expected: FAIL — `CanvasClient` not defined.

- [ ] **Step 3: Write `src/canvas-client.ts`**

```typescript
import "dotenv/config";
import type { CanvasCourse, CanvasAssignment } from "./types.js";

export class CanvasClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor() {
    const apiUrl = process.env.CANVAS_API_URL;
    const apiKey = process.env.CANVAS_API_KEY;

    if (!apiUrl || !apiKey) {
      throw new Error(
        "CANVAS_API_URL and CANVAS_API_KEY must be set.\n" +
          "Generate a token: Canvas → Account → Settings → New Access Token"
      );
    }

    this.baseUrl = `${apiUrl.replace(/\/$/, "")}/api/v1`;
    this.headers = { Authorization: `Bearer ${apiKey}` };
  }

  async getCourses(): Promise<CanvasCourse[]> {
    return this.fetchAllPages<CanvasCourse>(
      `${this.baseUrl}/courses?enrollment_state=active&per_page=100`
    );
  }

  async getAssignments(courseId: number): Promise<CanvasAssignment[]> {
    return this.fetchAllPages<CanvasAssignment>(
      `${this.baseUrl}/courses/${courseId}/assignments?per_page=100`
    );
  }

  private async fetchAllPages<T>(url: string): Promise<T[]> {
    const results: T[] = [];
    let nextUrl: string | null = url;

    while (nextUrl) {
      const response = await fetch(nextUrl, { headers: this.headers });

      if (!response.ok) {
        throw new Error(
          `Canvas API error ${response.status}: ${await response.text()}`
        );
      }

      const data = (await response.json()) as T[];
      results.push(...data);
      nextUrl = parseLinkHeader(response.headers.get("link"));
    }

    return results;
  }
}

function parseLinkHeader(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/<([^>]+)>;\s*rel="next"/);
  return match ? match[1] : null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/canvas-client.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/canvas-client.ts tests/canvas-client.test.ts
git commit -m "feat: Canvas HTTP client with pagination"
```

---

## Task 4: Assignment Tools

**Files:**
- Create: `src/tools/assignments.ts`
- Create: `tests/assignments.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/assignments.test.ts
import { describe, it, expect, vi } from "vitest";
import type { CanvasAssignment } from "../src/types.js";
import { getAllAssignmentsDue, getCourseAssignmentsDue } from "../src/tools/assignments.js";
import type { CanvasClient } from "../src/canvas-client.js";

const now = new Date();
const inTwoHours = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
const inThreeDays = new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString();
const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

const mockCourses = [
  { id: 1, name: "Physics 101", course_code: "PHYS101" },
  { id: 2, name: "Calculus II", course_code: "MATH201" },
];

const mockAssignments: Record<number, CanvasAssignment[]> = {
  1: [
    { id: 10, name: "Problem Set 3", due_at: inTwoHours, points_possible: 100, html_url: "https://example.com/a/10", course_id: 1 },
    { id: 11, name: "Lab Report", due_at: inThreeDays, points_possible: 50, html_url: "https://example.com/a/11", course_id: 1 },
    { id: 12, name: "Past Quiz", due_at: oneHourAgo, points_possible: 10, html_url: "https://example.com/a/12", course_id: 1 },
  ],
  2: [
    { id: 20, name: "Quiz 5", due_at: inTwoHours, points_possible: 20, html_url: "https://example.com/a/20", course_id: 2 },
    { id: 21, name: "No Due Date", due_at: null, points_possible: 0, html_url: "https://example.com/a/21", course_id: 2 },
  ],
};

function makeMockClient(): CanvasClient {
  return {
    getCourses: vi.fn().mockResolvedValue(mockCourses),
    getAssignments: vi.fn().mockImplementation((id: number) =>
      Promise.resolve(mockAssignments[id] ?? [])
    ),
  } as unknown as CanvasClient;
}

describe("getAllAssignmentsDue", () => {
  it("returns only assignments within the time window", async () => {
    const results = await getAllAssignmentsDue(makeMockClient(), 24);
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.assignmentName)).toContain("Problem Set 3");
    expect(results.map((r) => r.assignmentName)).toContain("Quiz 5");
  });

  it("excludes past assignments", async () => {
    const results = await getAllAssignmentsDue(makeMockClient(), 24);
    expect(results.map((r) => r.assignmentName)).not.toContain("Past Quiz");
  });

  it("excludes assignments with no due date", async () => {
    const results = await getAllAssignmentsDue(makeMockClient(), 24);
    expect(results.map((r) => r.assignmentName)).not.toContain("No Due Date");
  });

  it("excludes assignments beyond the window", async () => {
    const results = await getAllAssignmentsDue(makeMockClient(), 1);
    expect(results).toHaveLength(0);
  });

  it("returns results sorted by due date ascending", async () => {
    const results = await getAllAssignmentsDue(makeMockClient(), 24);
    for (let i = 1; i < results.length; i++) {
      expect(new Date(results[i].dueAt).getTime()).toBeGreaterThanOrEqual(
        new Date(results[i - 1].dueAt).getTime()
      );
    }
  });

  it("includes course name and code in each result", async () => {
    const results = await getAllAssignmentsDue(makeMockClient(), 24);
    const physics = results.find((r) => r.assignmentName === "Problem Set 3")!;
    expect(physics.courseName).toBe("Physics 101");
    expect(physics.courseCode).toBe("PHYS101");
  });
});

describe("getCourseAssignmentsDue", () => {
  it("finds course by partial name (case-insensitive)", async () => {
    const results = await getCourseAssignmentsDue(makeMockClient(), "physics", 24);
    expect(results.every((r) => r.courseName === "Physics 101")).toBe(true);
  });

  it("finds course by course code", async () => {
    const results = await getCourseAssignmentsDue(makeMockClient(), "PHYS101", 24);
    expect(results[0].courseName).toBe("Physics 101");
  });

  it("throws with course list when course not found", async () => {
    await expect(
      getCourseAssignmentsDue(makeMockClient(), "Chemistry", 24)
    ).rejects.toThrow('Course "Chemistry" not found');
  });

  it("only returns assignments within the window", async () => {
    const results = await getCourseAssignmentsDue(makeMockClient(), "physics", 24);
    expect(results.map((r) => r.assignmentName)).toContain("Problem Set 3");
    expect(results.map((r) => r.assignmentName)).not.toContain("Lab Report");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/assignments.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/tools/` directory and write `src/tools/assignments.ts`**

```typescript
import type { CanvasClient } from "../canvas-client.js";
import type { AssignmentResult } from "../types.js";

export async function getAllAssignmentsDue(
  client: CanvasClient,
  hoursAhead: number
): Promise<AssignmentResult[]> {
  const now = new Date();
  const cutoff = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
  const courses = await client.getCourses();
  const results: AssignmentResult[] = [];

  for (const course of courses) {
    const assignments = await client.getAssignments(course.id);
    for (const assignment of assignments) {
      if (!assignment.due_at) continue;
      const dueDate = new Date(assignment.due_at);
      if (dueDate >= now && dueDate <= cutoff) {
        results.push({
          courseName: course.name,
          courseCode: course.course_code,
          assignmentName: assignment.name,
          dueAt: assignment.due_at,
          pointsPossible: assignment.points_possible,
          url: assignment.html_url,
        });
      }
    }
  }

  return results.sort(
    (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
  );
}

export async function getCourseAssignmentsDue(
  client: CanvasClient,
  courseName: string,
  hoursAhead: number
): Promise<AssignmentResult[]> {
  const courses = await client.getCourses();
  const query = courseName.toLowerCase();

  const course = courses.find(
    (c) =>
      c.name.toLowerCase().includes(query) ||
      c.course_code.toLowerCase().includes(query)
  );

  if (!course) {
    const available = courses.map((c) => c.name).join(", ");
    throw new Error(
      `Course "${courseName}" not found. Your enrolled courses: ${available}`
    );
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
  const assignments = await client.getAssignments(course.id);

  return assignments
    .filter((a) => {
      if (!a.due_at) return false;
      const d = new Date(a.due_at);
      return d >= now && d <= cutoff;
    })
    .map((a) => ({
      courseName: course.name,
      courseCode: course.course_code,
      assignmentName: a.name,
      dueAt: a.due_at!,
      pointsPossible: a.points_possible,
      url: a.html_url,
    }))
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/assignments.test.ts
```

Expected: All 10 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tools/assignments.ts tests/assignments.test.ts
git commit -m "feat: assignment tools with time-window filtering"
```

---

## Task 5: Tool Registry

**Files:**
- Create: `src/tools/index.ts`

- [ ] **Step 1: Write `src/tools/index.ts`**

```typescript
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { CanvasClient } from "../canvas-client.js";
import { getAllAssignmentsDue, getCourseAssignmentsDue } from "./assignments.js";

export const tools: Tool[] = [
  {
    name: "get_all_assignments_due",
    description:
      "Get all assignments due across all enrolled Canvas courses within a time window. Use this when the student asks about upcoming work without specifying a course.",
    inputSchema: {
      type: "object",
      properties: {
        hours_ahead: {
          type: "number",
          description: "How many hours ahead to look (default: 24)",
        },
      },
    },
  },
  {
    name: "get_course_assignments_due",
    description:
      "Get assignments due for a specific Canvas course within a time window. Use this when the student specifies a course name.",
    inputSchema: {
      type: "object",
      properties: {
        course_name: {
          type: "string",
          description:
            "Name or partial name of the course (case-insensitive, fuzzy matched). Examples: 'physics', 'PHYS101', 'calculus'.",
        },
        hours_ahead: {
          type: "number",
          description: "How many hours ahead to look (default: 24)",
        },
      },
      required: ["course_name"],
    },
  },
];

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const hoursAhead =
    typeof args.hours_ahead === "number" ? args.hours_ahead : 24;

  try {
    const client = new CanvasClient();

    if (name === "get_all_assignments_due") {
      const results = await getAllAssignmentsDue(client, hoursAhead);
      const text =
        results.length === 0
          ? `No assignments due in the next ${hoursAhead} hours.`
          : JSON.stringify(results, null, 2);
      return { content: [{ type: "text", text }] };
    }

    if (name === "get_course_assignments_due") {
      if (typeof args.course_name !== "string") {
        throw new Error("course_name is required");
      }
      const results = await getCourseAssignmentsDue(
        client,
        args.course_name,
        hoursAhead
      );
      const text =
        results.length === 0
          ? `No assignments due in the next ${hoursAhead} hours for "${args.course_name}".`
          : JSON.stringify(results, null, 2);
      return { content: [{ type: "text", text }] };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/tools/index.ts
git commit -m "feat: MCP tool registry and dispatcher"
```

---

## Task 6: MCP Server

**Files:**
- Create: `src/server.ts`

- [ ] **Step 1: Write `src/server.ts`**

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { handleToolCall, tools } from "./tools/index.js";

export async function startServer(): Promise<void> {
  const server = new Server(
    { name: "canvas-mcp", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    return handleToolCall(
      request.params.name,
      (request.params.arguments ?? {}) as Record<string, unknown>
    );
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/server.ts
git commit -m "feat: MCP server wiring"
```

---

## Task 7: CLI Entry Point

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Write `src/index.ts`**

```typescript
#!/usr/bin/env node
import { Command } from "commander";

const program = new Command();

program
  .name("canvas-mcp")
  .description("Canvas LMS MCP server — query assignments from Claude, ChatGPT, Gemini, and OpenRouter agents");

program
  .command("setup")
  .description("Configure canvas-mcp for your AI client")
  .option(
    "--client <name>",
    "AI client to configure: claude | chatgpt | gemini | openrouter"
  )
  .action(async (options: { client?: string }) => {
    const { runSetup } = await import("./setup.js");
    await runSetup(options.client);
  });

// Default command: start the MCP server
program
  .command("serve", { isDefault: true, hidden: true })
  .action(async () => {
    const { startServer } = await import("./server.js");
    await startServer();
  });

program.parse();
```

- [ ] **Step 2: Verify it builds without errors**

```bash
npm run build
```

Expected: `dist/` directory created, no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: CLI entry point with serve/setup commands"
```

---

## Task 8: Setup Wizard

**Files:**
- Create: `src/setup.ts`

- [ ] **Step 1: Write `src/setup.ts`**

```typescript
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { dirname, join } from "path";
import { createInterface } from "readline/promises";

const CLIENT_CONFIGS: Record<
  string,
  { path: string; description: string }
> = {
  claude: {
    path: join(homedir(), ".claude", "claude_mcp_config.json"),
    description: "Claude Code",
  },
  gemini: {
    path: join(homedir(), ".gemini", "settings.json"),
    description: "Gemini CLI",
  },
  chatgpt: {
    path: join(homedir(), ".cursor", "mcp.json"),
    description: "Cursor (ChatGPT/OpenAI)",
  },
  openrouter: {
    path: join(homedir(), ".cline", "mcp_settings.json"),
    description: "Cline / OpenRouter clients",
  },
};

export async function runSetup(clientArg?: string): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  console.log("\nCanvas MCP Setup\n");

  const apiUrl = await rl.question(
    "Canvas URL (e.g. https://yourschool.instructure.com): "
  );
  const apiKey = await rl.question(
    "Canvas API token (Account -> Settings -> New Access Token): "
  );

  let clientKey = clientArg;
  if (!clientKey || !CLIENT_CONFIGS[clientKey]) {
    console.log("\nWhich AI client do you want to configure?");
    Object.entries(CLIENT_CONFIGS).forEach(([key, { description }]) => {
      console.log(`  ${key.padEnd(12)} ${description}`);
    });
    clientKey = (await rl.question("\nClient: ")).trim();
  }

  rl.close();

  const config = CLIENT_CONFIGS[clientKey];
  if (!config) {
    console.error(
      `Unknown client: "${clientKey}". Choose from: ${Object.keys(CLIENT_CONFIGS).join(", ")}`
    );
    process.exit(1);
  }

  const mcpEntry = {
    command: "npx",
    args: ["canvas-mcp"],
    env: {
      CANVAS_API_URL: apiUrl.trim(),
      CANVAS_API_KEY: apiKey.trim(),
    },
  };

  updateClientConfig(config.path, mcpEntry);
  console.log(`\nDone! Added canvas-mcp to ${config.path}`);
  console.log(`Restart ${config.description} to load the Canvas tools.`);
  console.log(
    "\nTry asking: \"What assignments do I have due in the next 24 hours?\""
  );
}

function updateClientConfig(
  configPath: string,
  entry: object
): void {
  mkdirSync(dirname(configPath), { recursive: true });

  let existing: Record<string, unknown> = {};
  if (existsSync(configPath)) {
    try {
      existing = JSON.parse(readFileSync(configPath, "utf-8")) as Record<
        string,
        unknown
      >;
    } catch {
      // file exists but is malformed — start fresh
    }
  }

  const mcpServers = (existing.mcpServers ?? {}) as Record<string, unknown>;
  mcpServers["canvas"] = entry;
  existing.mcpServers = mcpServers;

  writeFileSync(configPath, JSON.stringify(existing, null, 2) + "\n");
}
```

- [ ] **Step 2: Build and do a manual smoke test of setup**

```bash
npm run build
node dist/index.js setup --client claude
```

Expected: Prompts for Canvas URL and API token, then writes to `~/.claude/claude_mcp_config.json`.

- [ ] **Step 3: Commit**

```bash
git add src/setup.ts
git commit -m "feat: multi-client setup wizard"
```

---

## Task 9: README and npm Publish Prep

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`**

````markdown
# canvas-mcp

Query your Canvas LMS assignments from any AI agent — Claude, ChatGPT, Gemini, OpenRouter.

## Quick Start

### 1. Get your Canvas API token
Canvas → Account → Settings → **New Access Token**

### 2. Configure your AI client

```bash
npx canvas-mcp setup --client claude      # Claude Code
npx canvas-mcp setup --client chatgpt     # Cursor / OpenAI clients
npx canvas-mcp setup --client gemini      # Gemini CLI
npx canvas-mcp setup --client openrouter  # Cline / Open Router
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
      "args": ["canvas-mcp"],
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
- Auto-generated client from Canvas OpenAPI spec

```bash
git clone https://github.com/your-username/canvas-mcp
cd canvas-mcp
npm install
cp .env.example .env   # add your Canvas credentials
npm test
```

## License

MIT
````

- [ ] **Step 2: Run the full test suite one final time**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 3: Final build**

```bash
npm run build
```

Expected: `dist/` compiled cleanly, no errors.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: README with setup instructions and tool reference"
```

- [ ] **Step 5: Tag v1.0.0**

```bash
git tag v1.0.0
```

---

## Post-Plan: Publishing to npm

When ready to publish (run manually, not part of the build):

```bash
# Login to npm (one-time)
npm login

# Publish
npm publish --access public
```

Then anyone can install with:
```bash
npx canvas-mcp setup --client claude
```
````
