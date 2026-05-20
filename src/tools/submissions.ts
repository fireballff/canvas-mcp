import type { CanvasClient } from "../canvas-client.js";
import type { MissingAssignmentResult, SubmissionResult } from "../types.js";

export async function getMissingAssignments(
  client: CanvasClient
): Promise<MissingAssignmentResult[]> {
  const [courses, missing] = await Promise.all([
    client.getCourses(),
    client.getMissingSubmissions(),
  ]);

  const courseMap = new Map(courses.map((c) => [c.id, c]));

  return missing.map((a) => {
    const course = courseMap.get(a.course_id);
    return {
      courseName: course?.name ?? `Course ${a.course_id}`,
      courseCode: course?.course_code ?? "",
      assignmentName: a.name,
      dueAt: a.due_at,
      pointsPossible: a.points_possible,
      url: a.html_url,
    };
  });
}

export async function getSubmission(
  client: CanvasClient,
  courseName: string,
  assignmentName: string
): Promise<SubmissionResult> {
  const courses = await client.getCourses();
  const courseQuery = courseName.toLowerCase();
  const course = courses.find(
    (c) =>
      c.name.toLowerCase().includes(courseQuery) ||
      c.course_code.toLowerCase().includes(courseQuery)
  );
  if (!course) {
    const available = courses.map((c) => c.name).join(", ");
    throw new Error(`Course "${courseName}" not found. Your enrolled courses: ${available}`);
  }

  const assignments = await client.getAssignments(course.id);
  const assignQuery = assignmentName.toLowerCase();
  const assignment = assignments.find((a) =>
    a.name.toLowerCase().includes(assignQuery)
  );
  if (!assignment) {
    const available = assignments.map((a) => a.name).join(", ");
    throw new Error(
      `Assignment "${assignmentName}" not found in ${course.name}. Assignments: ${available}`
    );
  }

  const submission = await client.getSubmission(course.id, assignment.id);

  return {
    courseName: course.name,
    assignmentName: assignment.name,
    score: submission.score,
    grade: submission.grade,
    pointsPossible: assignment.points_possible,
    submittedAt: submission.submitted_at,
    status: submission.workflow_state,
    late: submission.late,
    missing: submission.missing,
    comments: (submission.submission_comments ?? []).map((c) => ({
      author: c.author_name,
      comment: c.comment,
      postedAt: c.created_at,
    })),
    url: assignment.html_url,
  };
}
