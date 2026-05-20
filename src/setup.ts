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
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });

  console.log("\nCanvas MCP Setup\n");

  const apiUrl = (await rl.question(
    "Canvas URL (e.g. https://yourschool.instructure.com): "
  )).trim();
  if (!apiUrl || !apiUrl.startsWith("https://")) {
    rl.close();
    console.error("Error: Canvas URL must start with https:// (plain http is not allowed — your API token would be sent unencrypted).");
    process.exit(1);
  }

  const apiKey = (await rl.question(
    "Canvas API token (Account -> Settings -> New Access Token): "
  )).trim();
  if (!apiKey) {
    rl.close();
    console.error("Error: API token cannot be empty.");
    process.exit(1);
  }

  let clientKey = clientArg?.toLowerCase();
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
    args: ["-y", "@fireballff/canvas-mcp"],
    env: {
      CANVAS_API_URL: apiUrl.trim(),
      CANVAS_API_KEY: apiKey.trim(),
    },
  };

  updateClientConfig(config.path, mcpEntry);
  console.log(`\nDone! Added canvas-mcp to ${config.path}`);
  console.log(`Restart ${config.description} to load the Canvas tools.`);
  console.log(
    '\nTry asking: "What assignments do I have due in the next 24 hours?"'
  );
}

export function updateClientConfig(
  configPath: string,
  entry: object
): void {
  mkdirSync(dirname(configPath), { recursive: true, mode: 0o700 });

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

  writeFileSync(configPath, JSON.stringify(existing, null, 2) + "\n", { mode: 0o600 });
}
