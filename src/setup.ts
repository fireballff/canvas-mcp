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

const PRIVATE_IP_RE = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|169\.254\.|0\.0\.0\.0|::1$|fe80:|fc|fd|localhost$)/i;

export function validateCanvasUrl(raw: string): string | null {
  if (!raw) return "Canvas URL cannot be empty.";
  if (!raw.startsWith("https://"))
    return "Canvas URL must start with https:// (plain http would send your token unencrypted).";
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return "Canvas URL is not a valid URL.";
  }
  if (parsed.username || parsed.password)
    return "Canvas URL must not contain credentials (no user:pass@ in the URL).";
  if (PRIVATE_IP_RE.test(parsed.hostname))
    return "Canvas URL must be a public hostname, not a private/internal IP address.";
  return null;
}

export async function runSetup(clientArg?: string): Promise<void> {
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });

  console.log("\nCanvas MCP Setup\n");

  const apiUrl = (await rl.question(
    "Canvas URL (e.g. https://yourschool.instructure.com): "
  )).trim();
  const urlError = validateCanvasUrl(apiUrl);
  if (urlError) {
    rl.close();
    console.error(`Error: ${urlError}`);
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

  const config = Object.hasOwn(CLIENT_CONFIGS, clientKey) ? CLIENT_CONFIGS[clientKey] : undefined;
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
