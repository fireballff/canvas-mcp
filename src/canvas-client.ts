import type {
  CanvasCourse,
  CanvasAssignment,
  CanvasEnrollment,
  CanvasAnnouncement,
  CanvasCalendarEvent,
  CanvasModule,
  CanvasMissingSubmission,
  CanvasSubmission,
} from "./types.js";

export class CanvasClient {
  private baseUrl: string;
  private origin: string;
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

    const cleanUrl = apiUrl.replace(/\/$/, "");
    let parsed: URL;
    try {
      parsed = new URL(cleanUrl);
    } catch {
      throw new Error("CANVAS_API_URL is not a valid URL.");
    }
    if (parsed.protocol !== "https:")
      throw new Error("CANVAS_API_URL must use https://.");
    if (parsed.username || parsed.password)
      throw new Error("CANVAS_API_URL must not contain credentials.");
    this.baseUrl = `${cleanUrl}/api/v1`;
    this.origin = parsed.origin;
    this.headers = { Authorization: `Bearer ${apiKey}` };
  }

  async getCourses(): Promise<CanvasCourse[]> {
    return this.fetchAllPages<CanvasCourse>(
      `${this.baseUrl}/courses?enrollment_state=active&per_page=100`
    );
  }

  async getAssignments(courseId: number): Promise<CanvasAssignment[]> {
    if (!Number.isInteger(courseId) || courseId <= 0) {
      throw new Error(`Invalid course ID: ${courseId}`);
    }
    return this.fetchAllPages<CanvasAssignment>(
      `${this.baseUrl}/courses/${courseId}/assignments?per_page=100`
    );
  }

  async getEnrollmentsWithGrades(): Promise<CanvasEnrollment[]> {
    return this.fetchAllPages<CanvasEnrollment>(
      `${this.baseUrl}/users/self/enrollments?include[]=grades&state[]=active&per_page=100`
    );
  }

  async getMissingSubmissions(): Promise<CanvasMissingSubmission[]> {
    return this.fetchAllPages<CanvasMissingSubmission>(
      `${this.baseUrl}/users/self/missing_submissions?per_page=100`
    );
  }

  async getAnnouncements(courseIds: number[], daysBack: number): Promise<CanvasAnnouncement[]> {
    const startDate = new Date(Date.now() - daysBack * 86400_000)
      .toISOString()
      .slice(0, 10);
    const params = new URLSearchParams({ start_date: startDate, per_page: "100" });
    for (const id of courseIds) params.append("context_codes[]", `course_${id}`);
    return this.fetchAllPages<CanvasAnnouncement>(
      `${this.baseUrl}/announcements?${params}`
    );
  }

  async getCalendarEvents(courseIds: number[], daysAhead: number): Promise<CanvasCalendarEvent[]> {
    const startDate = new Date().toISOString().slice(0, 10);
    const endDate = new Date(Date.now() + daysAhead * 86400_000)
      .toISOString()
      .slice(0, 10);
    const params = new URLSearchParams({
      type: "event",
      start_date: startDate,
      end_date: endDate,
      per_page: "100",
    });
    for (const id of courseIds) params.append("context_codes[]", `course_${id}`);
    return this.fetchAllPages<CanvasCalendarEvent>(
      `${this.baseUrl}/calendar_events?${params}`
    );
  }

  async getCourseSyllabus(courseId: number): Promise<{ name: string; syllabus_body: string | null }> {
    if (!Number.isInteger(courseId) || courseId <= 0) {
      throw new Error(`Invalid course ID: ${courseId}`);
    }
    return this.fetchOne<{ name: string; syllabus_body: string | null }>(
      `${this.baseUrl}/courses/${courseId}?include[]=syllabus_body`
    );
  }

  async getCourseModules(courseId: number): Promise<CanvasModule[]> {
    if (!Number.isInteger(courseId) || courseId <= 0) {
      throw new Error(`Invalid course ID: ${courseId}`);
    }
    return this.fetchAllPages<CanvasModule>(
      `${this.baseUrl}/courses/${courseId}/modules?include[]=items&per_page=50`
    );
  }

  async getSubmission(courseId: number, assignmentId: number): Promise<CanvasSubmission> {
    if (!Number.isInteger(courseId) || courseId <= 0) {
      throw new Error(`Invalid course ID: ${courseId}`);
    }
    if (!Number.isInteger(assignmentId) || assignmentId <= 0) {
      throw new Error(`Invalid assignment ID: ${assignmentId}`);
    }
    return this.fetchOne<CanvasSubmission>(
      `${this.baseUrl}/courses/${courseId}/assignments/${assignmentId}/submissions/self?include[]=submission_comments`
    );
  }

  private async fetchOne<T>(url: string): Promise<T> {
    const response = await fetch(url, { headers: this.headers });
    if (!response.ok) {
      throw new Error(`Canvas API error ${response.status} ${response.statusText}`);
    }
    return response.json() as Promise<T>;
  }

  private async fetchAllPages<T>(url: string): Promise<T[]> {
    const results: T[] = [];
    let nextUrl: string | null = url;

    while (nextUrl) {
      const response = await fetch(nextUrl, { headers: this.headers });

      if (!response.ok) {
        // Do not include response body — it could echo the Authorization header
        // on misconfigured proxies or wrong-host errors.
        throw new Error(`Canvas API error ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as T[];
      if (!Array.isArray(data)) {
        throw new Error("Canvas API returned an unexpected response shape.");
      }
      results.push(...data);

      const next = parseLinkHeader(response.headers.get("link"));
      // Same-origin check: never follow pagination to a different host.
      if (next && new URL(next).origin !== this.origin) {
        throw new Error("Canvas API returned a pagination URL pointing to a different host — aborting.");
      }
      nextUrl = next;
    }

    return results;
  }
}

function parseLinkHeader(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/<([^>]+)>;\s*rel="next"/);
  return match ? match[1] : null;
}
