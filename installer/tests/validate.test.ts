import { describe, it, expect } from "vitest";
import { validateCanvasUrl } from "../src/lib/validate";

describe("validateCanvasUrl", () => {
  it("rejects empty string", () => {
    expect(validateCanvasUrl("")).not.toBeNull();
  });

  it("rejects http://", () => {
    expect(validateCanvasUrl("http://canvas.school.edu")).not.toBeNull();
  });

  it("rejects credential injection https://user@evil.com", () => {
    expect(validateCanvasUrl("https://legitschool.edu@evil.com")).not.toBeNull();
  });

  it("rejects private IP 10.x.x.x", () => {
    expect(validateCanvasUrl("https://10.0.0.1")).not.toBeNull();
  });

  it("rejects localhost", () => {
    expect(validateCanvasUrl("https://127.0.0.1")).not.toBeNull();
  });

  it("accepts a valid https Canvas URL", () => {
    expect(validateCanvasUrl("https://ocean.instructure.com")).toBeNull();
  });

  it("accepts URL with trailing slash", () => {
    expect(validateCanvasUrl("https://canvas.school.edu/")).toBeNull();
  });
});
