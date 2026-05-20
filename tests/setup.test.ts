import { describe, it, expect, afterEach } from "vitest";
import { existsSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { updateClientConfig } from "../src/setup.js";

const tmpConfig = join(tmpdir(), `canvas-mcp-test-${Date.now()}.json`);

afterEach(() => {
  if (existsSync(tmpConfig)) rmSync(tmpConfig);
});

describe("updateClientConfig", () => {
  it("creates a new config file if none exists", () => {
    updateClientConfig(tmpConfig, { command: "npx", args: ["-y", "canvas-mcp"] });
    const written = JSON.parse(readFileSync(tmpConfig, "utf-8"));
    expect(written.mcpServers.canvas.command).toBe("npx");
    expect(written.mcpServers.canvas.args).toEqual(["-y", "canvas-mcp"]);
  });

  it("merges into an existing config without touching other entries", () => {
    writeFileSync(tmpConfig, JSON.stringify({
      mcpServers: { other: { command: "node", args: ["other.js"] } },
    }));
    updateClientConfig(tmpConfig, { command: "npx", args: ["-y", "canvas-mcp"] });
    const written = JSON.parse(readFileSync(tmpConfig, "utf-8"));
    expect(written.mcpServers.other).toBeDefined();
    expect(written.mcpServers.canvas.command).toBe("npx");
  });

  it("overwrites an existing canvas entry on re-run", () => {
    writeFileSync(tmpConfig, JSON.stringify({
      mcpServers: { canvas: { command: "old", args: [] } },
    }));
    updateClientConfig(tmpConfig, { command: "npx", args: ["-y", "canvas-mcp"] });
    const written = JSON.parse(readFileSync(tmpConfig, "utf-8"));
    expect(written.mcpServers.canvas.command).toBe("npx");
  });

  it("recovers from malformed JSON in existing config", () => {
    writeFileSync(tmpConfig, "not valid json {{{");
    updateClientConfig(tmpConfig, { command: "npx", args: ["-y", "canvas-mcp"] });
    const written = JSON.parse(readFileSync(tmpConfig, "utf-8"));
    expect(written.mcpServers.canvas.command).toBe("npx");
  });
});
