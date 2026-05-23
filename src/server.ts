import { createRequire } from "module";
// McpServer requires Zod schemas; we use raw JSON schemas so we intentionally use the low-level Server.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore – Server is deprecated in favour of McpServer but low-level API is correct here
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { handleToolCall, tools } from "./tools/index.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

export async function startServer(): Promise<void> {
  // @ts-ignore – intentional low-level API use (see import comment above)
  const server = new Server(
    { name: "canvas-mcp", version },
    { capabilities: { tools: {} } }
  );

  server.onerror = (error) => {
    process.stderr.write(`MCP server error: ${error.message}\n`);
  };

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
