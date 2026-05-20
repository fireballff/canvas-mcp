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

export interface CanvasEnrollment {
  course_id: number;
  grades: {
    current_score: number | null;
    current_grade: string | null;
    final_score: number | null;
    final_grade: string | null;
  } | null;
}

export interface CanvasAnnouncement {
  id: number;
  title: string;
  message: string;
  posted_at: string;
  html_url: string;
  context_code: string;
}

export interface CanvasCalendarEvent {
  id: number;
  title: string;
  start_at: string;
  end_at: string | null;
  description: string | null;
  html_url: string;
  context_code: string;
  location_name: string | null;
}

export interface CanvasModule {
  id: number;
  name: string;
  position: number;
  items_count: number;
  items?: CanvasModuleItem[];
}

export interface CanvasModuleItem {
  id: number;
  title: string;
  type: string;
  html_url: string | null;
}

export interface CanvasMissingSubmission {
  id: number;
  name: string;
  due_at: string | null;
  points_possible: number;
  html_url: string;
  course_id: number;
}

export interface CanvasSubmission {
  assignment_id: number;
  score: number | null;
  grade: string | null;
  submitted_at: string | null;
  workflow_state: string;
  late: boolean;
  missing: boolean;
  submission_comments: Array<{
    author_name: string;
    comment: string;
    created_at: string;
  }>;
}

// Result types returned to the AI

export interface AssignmentResult {
  courseName: string;
  courseCode: string;
  assignmentName: string;
  dueAt: string;
  pointsPossible: number;
  url: string;
}

export interface GradeResult {
  courseName: string;
  courseCode: string;
  currentScore: number | null;
  currentGrade: string | null;
  finalScore: number | null;
  finalGrade: string | null;
}

export interface AnnouncementResult {
  courseName: string;
  title: string;
  postedAt: string;
  message: string;
  url: string;
}

export interface CalendarEventResult {
  courseName: string;
  title: string;
  startAt: string;
  endAt: string | null;
  location: string | null;
  description: string | null;
  url: string;
}

export interface ModuleResult {
  name: string;
  position: number;
  items: Array<{ title: string; type: string; url: string | null }>;
}

export interface MissingAssignmentResult {
  courseName: string;
  courseCode: string;
  assignmentName: string;
  dueAt: string | null;
  pointsPossible: number;
  url: string;
}

export interface SubmissionResult {
  courseName: string;
  assignmentName: string;
  score: number | null;
  grade: string | null;
  pointsPossible: number;
  submittedAt: string | null;
  status: string;
  late: boolean;
  missing: boolean;
  comments: Array<{ author: string; comment: string; postedAt: string }>;
  url: string;
}
