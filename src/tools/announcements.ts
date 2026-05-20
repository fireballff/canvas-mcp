import type { CanvasClient } from "../canvas-client.js";
import type { AnnouncementResult } from "../types.js";
import { stripHtml, safeUrl } from "../utils.js";

function courseIdFromContextCode(code: string): number {
  return parseInt(code.replace("course_", ""), 10);
}

export async function getAnnouncements(
  client: CanvasClient,
  daysBack: number
): Promise<AnnouncementResult[]> {
  const courses = await client.getCourses();
  const courseMap = new Map(courses.map((c) => [c.id, c]));
  const announcements = await client.getAnnouncements(courses.map((c) => c.id), daysBack);

  return announcements.map((a) => {
    const courseId = courseIdFromContextCode(a.context_code);
    const course = courseMap.get(courseId);
    return {
      courseName: course?.name ?? a.context_code,
      title: a.title,
      postedAt: a.posted_at,
      message: stripHtml(a.message),
      url: safeUrl(a.html_url),
    };
  });
}

export async function getCourseAnnouncements(
  client: CanvasClient,
  courseName: string,
  daysBack: number
): Promise<AnnouncementResult[]> {
  const courses = await client.getCourses();
  const query = courseName.toLowerCase();
  const course = courses.find(
    (c) =>
      c.name.toLowerCase().includes(query) ||
      c.course_code.toLowerCase().includes(query)
  );
  if (!course) {
    const available = courses.map((c) => c.name).join(", ");
    throw new Error(`Course "${courseName}" not found. Your enrolled courses: ${available}`);
  }

  const announcements = await client.getAnnouncements([course.id], daysBack);
  return announcements.map((a) => ({
    courseName: course.name,
    title: a.title,
    postedAt: a.posted_at,
    message: stripHtml(a.message),
    url: a.html_url,
  }));
}
