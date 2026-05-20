export interface CanvasCourse {
  id: number;
  name: string;
  course_code: string;
}

export interface CanvasAssignment {
  id: number;
  name: string;
  due_at: string | null;
  points_possible: number;
  html_url: string;
  course_id: number;
}

export interface AssignmentResult {
  courseName: string;
  courseCode: string;
  assignmentName: string;
  dueAt: string;
  pointsPossible: number;
  url: string;
}
