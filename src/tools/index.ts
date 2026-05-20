import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { CanvasClient } from "../canvas-client.js";
import { getAllAssignmentsDue, getCourseAssignmentsDue } from "./assignments.js";

export const tools: Tool[] = [
  {
    name: "get_all_assignments_due",
    description:
      "Get all assignments due across all enrolled Canvas courses within a time window. Use this when the student asks about upcoming work without specifying a course.",
    inputSchema: {
      type: "object",
      properties: {
        hours_ahead: {
          type: "number",
          description: "How many hours ahead to look (default: 24)",
        },
      },
    },
  },
  {
    name: "get_course_assignments_due",
    description:
      "Get assignments due for a specific Canvas course within a time window. Use this when the student specifies a course name.",
    inputSchema: {
      type: "object",
      properties: {
        course_name: {
          type: "string",
          description:
            "Name or partial name of the course (case-insensitive, fuzzy matched). Examples: 'physics', 'PHYS101', 'calculus'.",
        },
        hours_ahead: {
          type: "number",
          description: "How many hours ahead to look (default: 24)",
        },
      },
      required: ["course_name"],
    },
  },
];

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const raw = typeof args.hours_ahead === "number" && Number.isFinite(args.hours_ahead)
    ? args.hours_ahead : 24;
  const hoursAhead = Math.min(Math.max(raw, 1), 8760);

  try {
    const client = new CanvasClient();

    if (name === "get_all_assignments_due") {
      const results = await getAllAssignmentsDue(client, hoursAhead);
      const text =
        results.length === 0
          ? `No assignments due in the next ${hoursAhead} hours.`
          : JSON.stringify(results, null, 2);
      return { content: [{ type: "text", text }] };
    }

    if (name === "get_course_assignments_due") {
      if (typeof args.course_name !== "string") {
        throw new Error("course_name is required");
      }
      const results = await getCourseAssignmentsDue(
        client,
        args.course_name,
        hoursAhead
      );
      const text =
        results.length === 0
          ? `No assignments due in the next ${hoursAhead} hours for "${args.course_name}".`
          : JSON.stringify(results, null, 2);
      return { content: [{ type: "text", text }] };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}
