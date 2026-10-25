import { describe, expect, it, vi } from "vitest";
import {
  buildIssueSearchQuery,
  clampPage,
  clampPerPage,
  GitHubApiError,
  searchGitHubIssues,
} from "../supabase/functions/_shared/githubIssues";

const rawIssue = {
  id: 42,
  number: 7,
  title: "Improve keyboard navigation",
  body: "Expected behavior is described here.",
  html_url: "https://github.com/example/accessibility/issues/7",
  state: "open",
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-20T00:00:00Z",
  closed_at: null,
  comments: 3,
  labels: [{ id: 9, name: "good first issue", color: "72e0bd" }],
  repository_url: "https://api.github.com/repos/example/accessibility",
};

function response(body: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...Object.fromEntries(new Headers(headers)) },
  });
}

describe("GitHub Issues REST integration", () => {
  it("builds an open-issue query with keywords and beginner-friendly labels", () => {
    const filters = buildIssueSearchQuery({
      keywords: "keyboard navigation",
      language: "TypeScript",
      beginnerFriendly: true,
      repository: "example/accessibility",
    });
    expect(filters.query).toContain("is:issue");
    expect(filters.query).toContain("is:open");
    expect(filters.query).toContain("keyboard navigation");
    expect(filters.query).toContain('label:"good first issue"');
    expect(filters.query).toContain('label:"help wanted"');
    expect(filters.query).toContain("repo:example/accessibility");
    expect(filters.query).not.toContain("language:TypeScript");
    expect(filters.language).toBe("TypeScript");
  });

  it("requests the official endpoint with safe pagination and normalizes returned issues", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      response({ total_count: 21, incomplete_results: false, items: [rawIssue] }),
    );
    const result = await searchGitHubIssues(
      { keywords: "keyboard", beginnerFriendly: true, page: 2, perPage: 100, sort: "updated" },
      { fetcher, headers: { Authorization: "Bearer server-only-token" } },
    );

    const [url, init] = fetcher.mock.calls[0];
    expect(String(url)).toMatch(/^https:\/\/api\.github\.com\/search\/issues\?/);
    const parsed = new URL(String(url));
    expect(parsed.searchParams.get("q")).toContain("is:open");
    expect(parsed.searchParams.get("q")).toContain("label:");
    expect(parsed.searchParams.get("page")).toBe("2");
    expect(parsed.searchParams.get("per_page")).toBe("20");
    expect(parsed.searchParams.get("sort")).toBe("updated");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer server-only-token");
    expect(result.items[0]).toMatchObject({
      id: 42,
      title: "Improve keyboard navigation",
      body: "Expected behavior is described here.",
      repository_full_name: "example/accessibility",
      number: 7,
      labels: [{ name: "good first issue" }],
      html_url: "https://github.com/example/accessibility/issues/7",
      state: "open",
      created_at: "2026-10-01T00:00:00Z",
      updated_at: "2026-10-20T00:00:00Z",
      language: null,
    });
    expect(result.total_count).toBe(21);
    expect(result.page).toBe(2);
    expect(result.perPage).toBe(20);
  });

  it("keeps programming language as a separate repository verification filter", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      response({ total_count: 1, items: [rawIssue] }),
    );
    const result = await searchGitHubIssues({ language: "TypeScript" }, { fetcher });
    const parsed = new URL(String(fetcher.mock.calls[0][0]));
    expect(parsed.searchParams.get("q")).not.toContain("language:");
    expect(result.incomplete_results).toBe(true);
    expect(result.items[0].language).toBeNull();
  });

  it("clamps invalid pagination and safely requests at most 20 issues", async () => {
    expect(clampPage(-4)).toBe(1);
    expect(clampPage(999)).toBe(50);
    expect(clampPerPage(0)).toBe(1);
    expect(clampPerPage(200)).toBe(20);

    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({ total_count: 0, items: [] }));
    const result = await searchGitHubIssues({ page: 999, perPage: 200 }, { fetcher });
    const parsed = new URL(String(fetcher.mock.calls[0][0]));
    expect(parsed.searchParams.get("page")).toBe("50");
    expect(parsed.searchParams.get("per_page")).toBe("20");
    expect(result.page).toBe(50);
    expect(result.items).toEqual([]);
  });

  it("returns valid empty search results without fabricating issues", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      response({ total_count: 0, incomplete_results: false, items: [] }),
    );
    await expect(searchGitHubIssues({ keywords: "no-match" }, { fetcher })).resolves.toMatchObject({
      items: [],
      total_count: 0,
      incomplete_results: false,
    });
  });

  it.each([
    [403, {}, "GitHub denied the issue search request", false],
    [403, { "x-ratelimit-remaining": "0" }, "GitHub API rate limit reached", true],
    [429, {}, "GitHub API rate limit reached", true],
  ])("handles GitHub HTTP %s responses", async (status, headers, expected, rateLimited) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({}, status, headers));
    await expect(searchGitHubIssues({}, { fetcher })).rejects.toMatchObject({
      status: rateLimited ? 429 : status,
      rateLimited,
      message: expect.stringContaining(expected),
    });
  });

  it("reports network failures explicitly", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("Network down"));
    await expect(searchGitHubIssues({}, { fetcher })).rejects.toBeInstanceOf(GitHubApiError);
    await expect(searchGitHubIssues({}, { fetcher })).rejects.toThrow(/Could not connect to the GitHub API/);
  });

  it("rejects malformed GitHub data instead of returning it as a successful search", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({
      total_count: 1,
      items: [{ id: "not-a-number", title: "Invalid issue" }],
    }));
    await expect(searchGitHubIssues({}, { fetcher })).rejects.toThrow(/invalid issue data/i);
  });
});
