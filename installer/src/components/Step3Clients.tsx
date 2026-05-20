import { useState, useEffect } from "react";
import { homeDir } from "@tauri-apps/api/path";
import { exists } from "@tauri-apps/plugin-fs";
import { KNOWN_CLIENTS } from "../lib/clients";
import type { SelectedClient } from "../types";

interface ClientRow {
  id: string;
  label: string;
  defaultPath: string;
  dirExists: boolean;
  checked: boolean;
  customPath: string;
}

interface Props {
  onNext: (clients: SelectedClient[]) => void;
  onBack: () => void;
}

function isValidConfigPath(path: string): boolean {
  if (!path.trim()) return false;
  if (!path.endsWith(".json")) return false;
  // Absolute path: starts with / (Unix) or drive letter (Windows)
  if (!path.startsWith("/") && !/^[A-Za-z]:[\\\/]/.test(path)) return false;
  return true;
}

export function Step3Clients({ onNext, onBack }: Props) {
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [otherChecked, setOtherChecked] = useState(false);
  const [otherPath, setOtherPath] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const home = await homeDir();
      const detected = await Promise.all(
        KNOWN_CLIENTS.map(async (c) => {
          const fullPath = `${home}/${c.configSubPath}`;
          const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
          const dirExists = await exists(dir);
          return { id: c.id, label: c.label, defaultPath: fullPath, dirExists, checked: dirExists, customPath: fullPath };
        })
      );
      setRows(detected);
      setLoading(false);
    })();
  }, []);

  function toggle(id: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, checked: !r.checked } : r)));
  }

  function setPath(id: string, path: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, customPath: path } : r)));
  }

  function handleNext() {
    const selected: SelectedClient[] = rows
      .filter((r) => r.checked && isValidConfigPath(r.customPath))
      .map((r) => ({ id: r.id, label: r.label, configPath: r.customPath }));
    if (otherChecked && isValidConfigPath(otherPath)) {
      selected.push({ id: "other", label: "Other", configPath: otherPath.trim() });
    }
    onNext(selected);
  }

  const anySelected = rows.some((r) => r.checked) || (otherChecked && isValidConfigPath(otherPath));

  if (loading) return <p>Detecting installed clients…</p>;

  return (
    <div className="step">
      <h2>Step 3 of 4 — Select AI Clients</h2>
      <p>Choose which AI clients to configure.</p>
      <div className="client-list">
        {rows.map((row) => (
          <div key={row.id} className="client-row">
            <label>
              <input type="checkbox" checked={row.checked} onChange={() => toggle(row.id)} />
              <strong>{row.label}</strong>
              {!row.dirExists && <span className="warn"> (directory not found — enter path manually)</span>}
            </label>
            {row.checked && (
              <>
                <input
                  type="text"
                  value={row.customPath}
                  onChange={(e) => setPath(row.id, e.target.value)}
                  readOnly={row.dirExists}
                  placeholder="/path/to/mcp-config.json"
                />
                {!row.dirExists && !isValidConfigPath(row.customPath) && (
                  <span className="warn"> Enter an absolute path ending in .json</span>
                )}
              </>
            )}
          </div>
        ))}
        <div className="client-row">
          <label>
            <input type="checkbox" checked={otherChecked} onChange={() => setOtherChecked((v) => !v)} />
            <strong>Other</strong>
          </label>
          {otherChecked && (
            <input
              type="text"
              value={otherPath}
              onChange={(e) => setOtherPath(e.target.value)}
              placeholder="/path/to/your-client/mcp-config.json"
            />
          )}
        </div>
      </div>
      <div className="actions">
        <button type="button" onClick={onBack}>← Back</button>
        <button onClick={handleNext} disabled={!anySelected}>Configure →</button>
      </div>
    </div>
  );
}
