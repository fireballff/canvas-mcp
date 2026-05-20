import { describe, it, expect, vi } from "vitest";
import type { CanvasAssignment } from "../src/types.js";
import { getAllAssignmentsDue, getCourseAssignmentsDue } from "../src/tools/assignments.js";
import type { CanvasClient } from "../src/canvas-client.js";

const now = new Date();
const inTwoHours = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
const inThreeDays = new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString();
const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

const mockCourses = [
  { id: 1, name: "Physics 101", course_code: "PHYS101" },
  { id: 2, name: "Calculus II", course_code: "MATH201" },
];

const mockAssignments: Record<number, CanvasAssignment[]> = {
  1: [
    { id: 10, name: "Problem Set 3", due_at: inTwoHours, points_possible: 100, html_url: "https://example.com/a/10", course_id: 1 },
    { id: 11, name: "Lab Report", due_at: inThreeDays, points_possible: 50, html_url: "https://example.com/a/11", course_id: 1 },
    { id: 12, name: "Past Quiz", due_at: oneHourAgo, points_possible: 10, html_url: "https://example.com/a/12", course_id: 1 },
  ],
  2: [
    { id: 20, name: "Quiz 5", due_at: inTwoHours, points_possible: 20, html_url: "https://example.com/a/20", course_id: 2 },
    { id: 21, name: "No Due Date", due_at: null, points_possible: 0, html_url: "https://example.com/a/21", course_id: 2 },
  ],
};

function makeMockClient(): CanvasClient {
  return {
    getCourses: vi.fn().mockResolvedValue(mockCourses),
    getAssignments: vi.fn().mockImplementation((id: number) =>
      Promise.resolve(mockAssignments[id] ?? [])
    ),
  } as unknown as CanvasClient;
}

describe("getAllAssignmentsDue", () => {
  it("returns only assignments within the time window", async () => {
    const results = await getAllAssignmentsDue(makeMockClient(), 24);
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.assignmentName)).toContain("Problem Set 3");
    expect(results.map((r) => r.assignmentName)).toContain("Quiz 5");
  });

  it("excludes past assignments", async () => {
    const results = await getAllAssignmentsDue(makeMockClient(), 24);
    expect(results.map((r) => r.assignmentName)).not.toContain("Past Quiz");
  });

  it("excludes assignments with no due date", async () => {
    const results = await getAllAssignmentsDue(makeMockClient(), 24);
    expect(results.map((r) => r.assignmentName)).not.toContain("No Due Date");
  });

  it("excludes assignments beyond the window", async () => {
    const results = await getAllAssignmentsDue(makeMockClient(), 1);
    expect(results).toHaveLength(0);
  });

  it("returns results sorted by due date ascending", async () => {
    const results = await getAllAssignmentsDue(makeMockClient(), 24);
    for (let i = 1; i < results.length; i++) {
      expect(new Date(results[i].dueAt).getTime()).toBeGreaterThanOrEqual(
        new Date(results[i - 1].dueAt).getTime()
      );
    }
  });

  it("includes course name and code in each result", async () => {
    const results = await getAllAssignmentsDue(makeMockClient(), 24);
    const physics = results.find((r) => r.assignmentName === "Problem Set 3")!;
    expect(physics.courseName).toBe("Physics 101");
    expect(physics.courseCode).toBe("PHYS101");
  });
});

describe("getCourseAssignmentsDue", () => {
  it("finds course by partial name (case-insensitive)", async () => {
    const results = await getCourseAssignmentsDue(makeMockClient(), "physics", 24);
    expect(results.every((r) => r.courseName === "Physics 101")).toBe(true);
  });

  it("finds course by course code", async () => {
    const results = await getCourseAssignmentsDue(makeMockClient(), "PHYS101", 24);
    expect(results[0].courseName).toBe("Physics 101");
  });

  it("throws with course list when course not found", async () => {
    await expect(
      getCourseAssignmentsDue(makeMockClient(), "Chemistry", 24)
    ).rejects.toThrow('Course "Chemistry" not found');
  });

  it("only returns assignments within the window", async () => {
    const results = await getCourseAssignmentsDue(makeMockClient(), "physics", 24);
    expect(results.map((r) => r.assignmentName)).toContain("Problem Set 3");
    expect(results.map((r) => r.assignmentName)).not.toContain("Lab Report");
  });
});
