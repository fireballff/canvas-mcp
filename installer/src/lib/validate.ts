const PRIVATE_IP_RE =
  /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|169\.254\.|::1$|fc|fd)/i;

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
