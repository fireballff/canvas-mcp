import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { CanvasClient } from "../canvas-client.js";
import { getAllAssignmentsDue, getCourseAssignmentsDue } from "./assignments.js";
import { getGrades, getCourseGrade } from "./grades.js";
import { getMissingAssignments, getSubmission } from "./submissions.js";
import { getAnnouncements, getCourseAnnouncements } from "./announcements.js";
import { getUpcomingEvents } from "./events.js";
import { listCourses, getCourseSyllabus, getCourseModules } from "./courses.js";

export const tools: Tool[] = [
  {
    name: "list_courses",
    description: "List all Canvas courses the student is currently enrolled in. Use this when the student asks what courses they have or needs a course list.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_all_assignments_due",
    description: "Get all assignments due across all enrolled Canvas courses within a time window. Use this when the student asks about upcoming work without specifying a course.",
    inputSchema: {
      type: "object",
      properties: {
        hours_ahead: { type: "number", description: "How many hours ahead to look (default: 24)" },
      },
    },
  },
  {
    name: "get_course_assignments_due",
    description: "Get assignments due for a specific Canvas course within a time window. Use this when the student specifies a course name.",
    inputSchema: {
      type: "object",
      properties: {
        course_name: {
          type: "string",
          description: "Name or partial name of the course (case-insensitive). Examples: 'physics', 'PHYS101', 'calculus'.",
        },
        hours_ahead: { type: "number", description: "How many hours ahead to look (default: 24)" },
      },
      required: ["course_name"],
    },
  },
  {
    name: "get_grades",
    description: "Get current grades for all enrolled Canvas courses. Use this when the student asks about their grades overall or across all classes.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_course_grade",
    description: "Get the current grade for a specific Canvas course. Use this when the student asks about their grade in a particular class.",
    inputSchema: {
      type: "object",
      properties: {
        course_name: {
          type: "string",
          description: "Name or partial name of the course. Examples: 'physics', 'MATH201'.",
        },
      },
      required: ["course_name"],
    },
  },
  {
    name: "get_missing_assignments",
    description: "Get all assignments the student has not submitted that are past due. Use this when the student asks what they are missing or haven't turned in.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_submission",
    description: "Get the student's submission details for a specific assignment, including score, grade, and instructor comments. Use this when the student asks what they got on a specific assignment.",
    inputSchema: {
      type: "object",
      properties: {
        course_name: {
          type: "string",
          description: "Name or partial name of the course.",
        },
        assignment_name: {
          type: "string",
          description: "Name or partial name of the assignment. Examples: 'midterm', 'problem set 3', 'lab report'.",
        },
      },
      required: ["course_name", "assignment_name"],
    },
  },
  {
    name: "get_announcements",
    description: "Get recent announcements from all enrolled Canvas courses. Use this when the student asks about announcements or news from their courses.",
    inputSchema: {
      type: "object",
      properties: {
        days_back: { type: "number", description: "How many days back to look (default: 7)" },
      },
    },
  },
  {
    name: "get_course_announcements",
    description: "Get recent announcements from a specific Canvas course. Use this when the student asks about announcements in a particular class.",
    inputSchema: {
      type: "object",
      properties: {
        course_name: {
          type: "string",
          description: "Name or partial name of the course.",
        },
        days_back: { type: "number", description: "How many days back to look (default: 7)" },
      },
      required: ["course_name"],
    },
  },
  {
    name: "get_upcoming_events",
    description: "Get upcoming calendar events (exams, office hours, course events) from all enrolled Canvas courses. Use this when the student asks about events, not just assignment due dates.",
    inputSchema: {
      type: "object",
      properties: {
        days_ahead: { type: "number", description: "How many days ahead to look (default: 14)" },
      },
    },
  },
  {
    name: "get_course_syllabus",
    description: "Get the syllabus for a specific Canvas course. Use this when the student asks about course policies, grading breakdown, late work policy, or the course overview.",
    inputSchema: {
      type: "object",
      properties: {
        course_name: {
          type: "string",
          description: "Name or partial name of the course.",
        },
      },
      required: ["course_name"],
    },
  },
  {
    name: "get_course_modules",
    description: "Get the module structure for a specific Canvas course, showing how the course content is organized. Use this when the student asks about course structure, what topics are covered, or what's coming up in the course.",
    inputSchema: {
      type: "object",
      properties: {
        course_name: {
          type: "string",
          description: "Name or partial name of the course.",
        },
      },
      required: ["course_name"],
    },
  },
];

type ToolResult = { content: Array<{ type: string; text: string }>; isError?: boolean };

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  try {
    const client = new CanvasClient();
    let result: unknown;

    switch (name) {
      case "list_courses":
        result = await listCourses(client);
        break;

      case "get_all_assignments_due": {
        const hours = clampHours(args.hours_ahead, 24);
        result = await getAllAssignmentsDue(client, hours);
        if (Array.isArray(result) && result.length === 0)
          return text(`No assignments due in the next ${hours} hours.`);
        break;
      }

      case "get_course_assignments_due": {
        requireString(args.course_name, "course_name");
        const hours = clampHours(args.hours_ahead, 24);
        result = await getCourseAssignmentsDue(client, args.course_name as string, hours);
        if (Array.isArray(result) && result.length === 0)
          return text(`No assignments due in the next ${hours} hours for "${args.course_name}".`);
        break;
      }

      case "get_grades":
        result = await getGrades(client);
        break;

      case "get_course_grade":
        requireString(args.course_name, "course_name");
        result = await getCourseGrade(client, args.course_name as string);
        break;

      case "get_missing_assignments":
        result = await getMissingAssignments(client);
        if (Array.isArray(result) && result.length === 0)
          return text("No missing assignments found.");
        break;

      case "get_submission":
        requireString(args.course_name, "course_name");
        requireString(args.assignment_name, "assignment_name");
        result = await getSubmission(client, args.course_name as string, args.assignment_name as string);
        break;

      case "get_announcements": {
        const days = clampDays(args.days_back, 7);
        result = await getAnnouncements(client, days);
        if (Array.isArray(result) && result.length === 0)
          return text(`No announcements in the last ${days} days.`);
        break;
      }

      case "get_course_announcements": {
        requireString(args.course_name, "course_name");
        const days = clampDays(args.days_back, 7);
        result = await getCourseAnnouncements(client, args.course_name as string, days);
        if (Array.isArray(result) && result.length === 0)
          return text(`No announcements in the last ${days} days for "${args.course_name}".`);
        break;
      }

      case "get_upcoming_events": {
        const days = clampDays(args.days_ahead, 14);
        result = await getUpcomingEvents(client, days);
        if (Array.isArray(result) && result.length === 0)
          return text(`No calendar events in the next ${days} days.`);
        break;
      }

      case "get_course_syllabus":
        requireString(args.course_name, "course_name");
        result = await getCourseSyllabus(client, args.course_name as string);
        break;

      case "get_course_modules":
        requireString(args.course_name, "course_name");
        result = await getCourseModules(client, args.course_name as string);
        if (Array.isArray(result) && result.length === 0)
          return text(`No modules found for "${args.course_name}".`);
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return text(JSON.stringify(result, null, 2));
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true,
    };
  }
}

function text(t: string): ToolResult {
  return { content: [{ type: "text", text: t }] };
}

function requireString(value: unknown, name: string): void {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} is required`);
  }
}

function clampHours(raw: unknown, defaultVal: number): number {
  const n = typeof raw === "number" && Number.isFinite(raw) ? raw : defaultVal;
  return Math.min(Math.max(n, 1), 8760);
}

function clampDays(raw: unknown, defaultVal: number): number {
  const n = typeof raw === "number" && Number.isFinite(raw) ? raw : defaultVal;
  return Math.min(Math.max(n, 1), 365);
}
