import type { CanvasClient } from "../canvas-client.js";
import type { AssignmentResult, CanvasCourse } from "../types.js";

const SAFE_URL_SCHEMES = new Set(["https:"]);
const CONCURRENCY = 10;

function safeUrl(url: string): string {
  try {
    return SAFE_URL_SCHEMES.has(new URL(url).protocol) ? url : "";
  } catch {
    return "";
  }
}

async function mapConcurrent<T, U>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<U>
): Promise<U[]> {
  const results: U[] = [];
  for (let i = 0; i < items.length; i += limit) {
    const batch = await Promise.all(items.slice(i, i + limit).map(fn));
    results.push(...batch);
  }
  return results;
}

export async function getAllAssignmentsDue(
  client: CanvasClient,
  hoursAhead: number
): Promise<AssignmentResult[]> {
  const now = new Date();
  const cutoff = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
  const courses = await client.getCourses();

  const allAssignments = await mapConcurrent(courses, CONCURRENCY, (course) =>
    client.getAssignments(course.id)
  );

  const results: AssignmentResult[] = [];
  for (const [i, assignments] of allAssignments.entries()) {
    const course = courses[i];
    for (const assignment of assignments) {
      if (!assignment.due_at) continue;
      const dueDate = new Date(assignment.due_at);
      if (dueDate >= now && dueDate <= cutoff) {
        results.push({
          courseName: course.name,
          courseCode: course.course_code,
          assignmentName: assignment.name,
          dueAt: assignment.due_at,
          pointsPossible: assignment.points_possible,
          url: safeUrl(assignment.html_url),
        });
      }
    }
  }

  return results.sort(
    (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
  );
}

export async function getCourseAssignmentsDue(
  client: CanvasClient,
  courseName: string,
  hoursAhead: number
): Promise<AssignmentResult[]> {
  const courses = await client.getCourses();
  const query = courseName.toLowerCase();

  const course = courses.find(
    (c) =>
      c.name.toLowerCase().includes(query) ||
      c.course_code.toLowerCase().includes(query)
  );

  if (!course) {
    const available = courses.map((c) => c.name).join(", ");
    throw new Error(
      `Course "${courseName}" not found. Your enrolled courses: ${available}`
    );
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
  const assignments = await client.getAssignments(course.id);

  return assignments
    .filter((a) => {
      if (!a.due_at) return false;
      const d = new Date(a.due_at);
      return d >= now && d <= cutoff;
    })
    .map((a) => ({
      courseName: course.name,
      courseCode: course.course_code,
      assignmentName: a.name,
      dueAt: a.due_at!,
      pointsPossible: a.points_possible,
      url: safeUrl(a.html_url),
    }))
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
}
