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

  it("builds the correct Codex path", () => {
    const path = getConfigPath("/Users/test", "codex");
    expect(path).toBe("/Users/test/.codex/config.json");
  });

  it("returns null for unknown client id", () => {
    const path = getConfigPath("/Users/test", "unknown");
    expect(path).toBeNull();
  });
});
