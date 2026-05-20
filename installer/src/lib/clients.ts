import type { ClientDef } from "../types";

export const KNOWN_CLIENTS: ClientDef[] = [
  {
    id: "claude",
    label: "Claude Code",
    configSubPath: ".claude/claude_mcp_config.json",
  },
  {
    id: "cursor",
    label: "Cursor",
    configSubPath: ".cursor/mcp.json",
  },
  {
    id: "codex",
    label: "Codex",
    configSubPath: ".codex/config.json",
  },
];

export function getConfigPath(homeDir: string, clientId: string): string | null {
  const client = KNOWN_CLIENTS.find((c) => c.id === clientId);
  if (!client) return null;
  return `${homeDir}/${client.configSubPath}`;
}
