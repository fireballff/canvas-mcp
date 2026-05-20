const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (m) => HTML_ENTITIES[m] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

const SAFE_URL_SCHEMES = new Set(["https:"]);

export function safeUrl(url: string | null | undefined): string {
  if (!url) return "";
  try {
    return SAFE_URL_SCHEMES.has(new URL(url).protocol) ? url : "";
  } catch {
    return "";
  }
}
