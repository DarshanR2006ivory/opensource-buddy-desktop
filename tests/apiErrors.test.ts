import { describe, expect, it } from "vitest";
import { getFunctionErrorMessage } from "../src/lib/apiErrors";

describe("Edge Function error handling", () => {
  it("uses a safe message from a failed API response", async () => {
    const response = new Response(JSON.stringify({ error: "GitHub API rate limit reached." }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
    await expect(getFunctionErrorMessage("Function returned an error", response)).resolves.toBe(
      "GitHub API rate limit reached.",
    );
  });

  it("preserves the SDK error when the response body is not valid JSON", async () => {
    const response = new Response("upstream failure", { status: 502 });
    await expect(getFunctionErrorMessage("Issue service failed.", response)).resolves.toBe(
      "Issue service failed.",
    );
  });

  it("does not replace an SDK error without an HTTP response", async () => {
    await expect(getFunctionErrorMessage("Network request failed.", undefined)).resolves.toBe(
      "Network request failed.",
    );
  });
});
