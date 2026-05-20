import type { CanvasClient } from "../canvas-client.js";
import type { GradeResult } from "../types.js";

export async function getGrades(client: CanvasClient): Promise<GradeResult[]> {
  const [courses, enrollments] = await Promise.all([
    client.getCourses(),
    client.getEnrollmentsWithGrades(),
  ]);

  const courseMap = new Map(courses.map((c) => [c.id, c]));

  return enrollments
    .filter((e) => courseMap.has(e.course_id))
    .map((e) => {
      const course = courseMap.get(e.course_id)!;
      return {
        courseName: course.name,
        courseCode: course.course_code,
        currentScore: e.grades?.current_score ?? null,
        currentGrade: e.grades?.current_grade ?? null,
        finalScore: e.grades?.final_score ?? null,
        finalGrade: e.grades?.final_grade ?? null,
      };
    });
}

export async function getCourseGrade(
  client: CanvasClient,
  courseName: string
): Promise<GradeResult> {
  const results = await getGrades(client);
  const query = courseName.toLowerCase();
  const match = results.find(
    (r) =>
      r.courseName.toLowerCase().includes(query) ||
      r.courseCode.toLowerCase().includes(query)
  );
  if (!match) {
    const available = results.map((r) => r.courseName).join(", ");
    throw new Error(`Course "${courseName}" not found. Your enrolled courses: ${available}`);
  }
  return match;
}
