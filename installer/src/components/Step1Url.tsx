import { useState } from "react";
import { validateCanvasUrl } from "../lib/validate";

interface Props {
  initialValue: string;
  onNext: (url: string) => void;
}

export function Step1Url({ initialValue, onNext }: Props) {
  const [url, setUrl] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);

  function handleBlur() {
    setError(validateCanvasUrl(url.trim()));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validateCanvasUrl(url.trim());
    if (err) { setError(err); return; }
    onNext(url.trim());
  }

  return (
    <div className="step">
      <h2>Step 1 of 4 — Canvas URL</h2>
      <p>Enter your school's Canvas address.</p>
      <form onSubmit={handleSubmit}>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onBlur={handleBlur}
          placeholder="https://yourschool.instructure.com"
          autoFocus
        />
        {error && <p className="error">{error}</p>}
        <details className="hint">
          <summary>Where do I find this?</summary>
          <p>
            This is the web address you use to log in to Canvas — usually{" "}
            <code>https://yourschool.instructure.com</code> or{" "}
            <code>https://canvas.yourschool.edu</code>.
          </p>
        </details>
        <button type="submit" disabled={!url}>Next →</button>
      </form>
    </div>
  );
}
