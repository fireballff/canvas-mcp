import { useState } from "react";

interface Props {
  onNext: (token: string) => void;
  onBack: () => void;
}

export function Step2Token({ onNext, onBack }: Props) {
  const [token, setToken] = useState("");
  const [visible, setVisible] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;
    onNext(token.trim());
  }

  return (
    <div className="step">
      <h2>Step 2 of 4 — API Token</h2>
      <p>Generate an access token so Canvas MCP can read your assignments.</p>
      <form onSubmit={handleSubmit}>
        <div className="token-input">
          <input
            type={visible ? "text" : "password"}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste your token here"
            autoFocus
          />
          <button type="button" onClick={() => setVisible((v) => !v)}>
            {visible ? "Hide" : "Show"}
          </button>
        </div>
        <details className="hint">
          <summary>How do I get a token?</summary>
          <ol>
            <li>Log in to Canvas and click your profile picture (top-left).</li>
            <li>Go to <strong>Account → Settings</strong>.</li>
            <li>Scroll to <strong>Approved Integrations</strong>, click <strong>New Access Token</strong>.</li>
            <li>Give it any name and click <strong>Generate Token</strong>.</li>
            <li>Copy the token and paste it here.</li>
          </ol>
        </details>
        <div className="actions">
          <button type="button" onClick={onBack}>← Back</button>
          <button type="submit" disabled={!token.trim()}>Next →</button>
        </div>
      </form>
    </div>
  );
}
