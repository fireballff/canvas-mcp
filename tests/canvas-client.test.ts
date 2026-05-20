import { describe, it, expect, vi, afterEach } from "vitest";

// Set env before importing the module
process.env.CANVAS_API_URL = "https://test.instructure.com";
process.env.CANVAS_API_KEY = "test-key";

const { CanvasClient } = await import("../src/canvas-client.js");

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CanvasClient", () => {
  it("throws if env vars are missing", async () => {
    const originalUrl = process.env.CANVAS_API_URL;
    try {
      delete process.env.CANVAS_API_URL;
      expect(() => new CanvasClient()).toThrow("CANVAS_API_URL");
    } finally {
      process.env.CANVAS_API_URL = originalUrl;
    }
  });

  it("fetches a single page of courses", async () => {
    const mockCourses = [
      { id: 1, name: "Physics 101", course_code: "PHYS101" },
    ];
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockCourses), { status: 200, headers: {} })
    );

    const client = new CanvasClient();
    const courses = await client.getCourses();
    expect(courses).toEqual(mockCourses);
  });

  it("follows pagination Link headers", async () => {
    const page1 = [{ id: 1, name: "Physics 101", course_code: "PHYS101" }];
    const page2 = [{ id: 2, name: "Calculus II", course_code: "MATH201" }];

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify(page1), {
          status: 200,
          headers: { link: '<https://test.instructure.com/api/v1/courses?page=2>; rel="next"' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(page2), { status: 200, headers: {} })
      );

    const client = new CanvasClient();
    const courses = await client.getCourses();
    expect(courses).toHaveLength(2);
  });

  it("throws a readable error on non-200 response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Unauthorized", { status: 401 })
    );
    const client = new CanvasClient();
    await expect(client.getCourses()).rejects.toThrow("Canvas API error 401");
  });
});
