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
