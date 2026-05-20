import type { CanvasClient } from "../canvas-client.js";
import type { ModuleResult } from "../types.js";
import { stripHtml } from "../utils.js";

export async function listCourses(client: CanvasClient) {
  const courses = await client.getCourses();
  return courses.map((c) => ({ name: c.name, code: c.course_code, id: c.id }));
}

export async function getCourseSyllabus(client: CanvasClient, courseName: string) {
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

  const data = await client.getCourseSyllabus(course.id);
  const body = data.syllabus_body
    ? stripHtml(data.syllabus_body)
    : "No syllabus posted for this course.";

  return { courseName: course.name, courseCode: course.course_code, syllabus: body };
}

export async function getCourseModules(
  client: CanvasClient,
  courseName: string
): Promise<ModuleResult[]> {
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

  const modules = await client.getCourseModules(course.id);
  return modules.map((m) => ({
    name: m.name,
    position: m.position,
    items: (m.items ?? []).map((item) => ({
      title: item.title,
      type: item.type,
      url: item.html_url ?? null,
    })),
  }));
}
