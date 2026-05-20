import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { SelectedClient } from "../types";

type Phase = "extracting" | "writing" | "verifying" | "done" | "error";

interface Props {
  canvasUrl: string;
  canvasToken: string;
  selectedClients: SelectedClient[];
  onBack: () => void;
}

export function Step4Verify({ canvasUrl, canvasToken, selectedClients, onBack }: Props) {
  const [phase, setPhase] = useState<Phase>("extracting");
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    try {
      setPhase("extracting");
      const installPath = await invoke<string>("extract_sidecar");

      setPhase("writing");
      await invoke("write_config", {
        installPath,
        canvasUrl,
        canvasKey: canvasToken,
        configPaths: selectedClients.map((c) => c.configPath),
      });

      setPhase("verifying");
      await invoke("verify_canvas", { url: canvasUrl, token: canvasToken });

      setPhase("done");
    } catch (e) {
      const raw = String(e);
      const safe = canvasToken ? raw.split(canvasToken).join("[token]") : raw;
      setError(safe);
      setPhase("error");
    }
  }, [canvasUrl, canvasToken, selectedClients]);

  useEffect(() => { run(); }, [run]);

  const labels: Record<Phase, string> = {
    extracting: "Copying canvas-mcp to your system…",
    writing: "Writing config files…",
    verifying: "Testing your Canvas connection…",
    done: "",
    error: "",
  };

  if (phase === "done") {
    return (
      <div className="step step-done">
        <div className="success-icon">✓</div>
        <h2>All done!</h2>
        <p>Restart {selectedClients.map((c) => c.label).join(", ")} to load Canvas tools.</p>
        <p className="hint">Try asking: "What assignments do I have due in the next 24 hours?"</p>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="step step-error">
        <h2>Something went wrong</h2>
        <p className="error">{error}</p>
        <button onClick={onBack}>← Go back and fix</button>
      </div>
    );
  }

  return (
    <div className="step step-loading">
      <h2>Step 4 of 4 — Configuring…</h2>
      <div className="spinner" />
      <p>{labels[phase]}</p>
    </div>
  );
}
