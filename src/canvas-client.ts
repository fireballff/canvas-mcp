import type { CanvasCourse, CanvasAssignment } from "./types.js";

export class CanvasClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor() {
    const apiUrl = process.env.CANVAS_API_URL;
    const apiKey = process.env.CANVAS_API_KEY;

    if (!apiUrl || !apiKey) {
      throw new Error(
        "CANVAS_API_URL and CANVAS_API_KEY must be set.\n" +
          "Generate a token: Canvas → Account → Settings → New Access Token"
      );
    }

    this.baseUrl = `${apiUrl.replace(/\/$/, "")}/api/v1`;
    this.headers = { Authorization: `Bearer ${apiKey}` };
  }

  async getCourses(): Promise<CanvasCourse[]> {
    return this.fetchAllPages<CanvasCourse>(
      `${this.baseUrl}/courses?enrollment_state=active&per_page=100`
    );
  }

  async getAssignments(courseId: number): Promise<CanvasAssignment[]> {
    return this.fetchAllPages<CanvasAssignment>(
      `${this.baseUrl}/courses/${courseId}/assignments?per_page=100`
    );
  }

  private async fetchAllPages<T>(url: string): Promise<T[]> {
    const results: T[] = [];
    let nextUrl: string | null = url;

    while (nextUrl) {
      const response = await fetch(nextUrl, { headers: this.headers });

      if (!response.ok) {
        throw new Error(
          `Canvas API error ${response.status}: ${await response.text()}`
        );
      }

      const data = (await response.json()) as T[];
      if (!Array.isArray(data)) {
        throw new Error(`Canvas API returned unexpected response shape: ${JSON.stringify(data)}`);
      }
      results.push(...data);
      nextUrl = parseLinkHeader(response.headers.get("link"));
    }

    return results;
  }
}

function parseLinkHeader(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/<([^>]+)>;\s*rel="next"/);
  return match ? match[1] : null;
}
