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
