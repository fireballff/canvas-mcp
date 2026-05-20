#!/usr/bin/env node
import "dotenv/config";
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
