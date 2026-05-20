export interface WizardState {
  step: 1 | 2 | 3 | 4;
  canvasUrl: string;
  canvasToken: string;
  selectedClients: SelectedClient[];
  installPath: string | null;
  error: string | null;
}

export interface SelectedClient {
  id: string;
  label: string;
  configPath: string;
}

export interface ClientDef {
  id: string;
  label: string;
  configSubPath: string; // relative to home dir, e.g. ".claude/claude_mcp_config.json"
}
