import type { CanvasClient } from "../canvas-client.js";
import type { CalendarEventResult } from "../types.js";

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function courseIdFromContextCode(code: string): number {
  return parseInt(code.replace("course_", ""), 10);
}

export async function getUpcomingEvents(
  client: CanvasClient,
  daysAhead: number
): Promise<CalendarEventResult[]> {
  const courses = await client.getCourses();
  const courseMap = new Map(courses.map((c) => [c.id, c]));
  const events = await client.getCalendarEvents(courses.map((c) => c.id), daysAhead);

  return events
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
    .map((e) => {
      const courseId = courseIdFromContextCode(e.context_code);
      const course = courseMap.get(courseId);
      return {
        courseName: course?.name ?? e.context_code,
        title: e.title,
        startAt: e.start_at,
        endAt: e.end_at,
        location: e.location_name,
        description: e.description ? stripHtml(e.description) : null,
        url: e.html_url,
      };
    });
}
