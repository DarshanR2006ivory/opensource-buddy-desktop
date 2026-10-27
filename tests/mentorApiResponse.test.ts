import { describe, expect, it } from "vitest";
import { readMentorApiResponse } from "../src/lib/mentorApiResponse";

describe("AI mentor API response parsing", () => {
  it("explains how to run the local API when the SPA returns HTML", async () => {
    const response = new Response("<!doctype html><html></html>", {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });

    await expect(readMentorApiResponse(response)).rejects.toThrow(
      /Restart `npm run dev`.*local AI mentor backend/s,
    );
  });

  it("parses JSON error responses for normal API error handling", async () => {
    const response = new Response(JSON.stringify({ error: "AI mentor is not configured." }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });

    await expect(readMentorApiResponse(response)).resolves.toEqual({
      error: "AI mentor is not configured.",
    });
  });

  it("reports non-HTML malformed responses with their status", async () => {
    const response = new Response("upstream failure", { status: 502 });

    await expect(readMentorApiResponse(response)).rejects.toThrow(
      "The AI mentor API returned a non-JSON response (HTTP 502).",
    );
  });
});
