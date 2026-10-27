import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GitHubIssue } from "../src/types/domain";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("../src/lib/supabase", () => ({
  supabase: { auth: { getSession: mocks.getSession } },
}));

import { generateContributionGuide } from "../src/lib/issues";

const issue: GitHubIssue = {
  id: 55,
  number: 4,
  title: "Keyboard navigation is broken",
  body: "Arrow keys do not move focus.",
  repository_full_name: "example/menu",
  html_url: "https://github.com/example/menu/issues/4",
  state: "open",
  created_at: "2026-10-20T00:00:00Z",
  updated_at: "2026-10-24T00:00:00Z",
  closed_at: null,
  comments: 1,
  labels: [{ name: "help wanted" }],
  repository_url: "https://api.github.com/repos/example/menu",
  repository: "menu",
  owner: "example",
  language: "TypeScript",
};

const guide = {
  summary: "Improve keyboard navigation.",
  issue_explanation: "Arrow keys do not move focus.",
  expected_outcome: "Arrow keys move focus.",
  possible_root_causes: ["A focus handler may be missing."],
  files_to_inspect: ["Suggested area: menu keyboard handling."],
  implementation_steps: ["Inspect behavior.", "Implement focus changes."],
  example_code: "// Illustrative only",
  test_commands: ["Check project docs for the test command."],
  edge_cases: ["Empty menus."],
  pull_request_checklist: ["Link the issue."],
  prerequisites: [],
  setup: [],
  steps: [],
  files_to_investigate: [],
  testing: [],
  pull_request: [],
  verify: [],
  source_notes: [],
  context_note: "Repository files were not inspected.",
  repository_verification: "not_performed",
  generated_by: "ai",
  links: {
    issue: issue.html_url,
    repository: "https://github.com/example/menu",
    readme: null,
    contributing: null,
  },
};

describe("AI mentor client integration", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: "supabase-user-token" } },
      error: null,
    });
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ guide }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", mocks.fetch);
  });

  it("posts the selected issue to the local API with the Supabase session token", async () => {
    await expect(generateContributionGuide(issue)).resolves.toMatchObject({
      issue_explanation: guide.issue_explanation,
      generated_by: "ai",
    });

    expect(mocks.fetch).toHaveBeenCalledWith("/api/ai-mentor", expect.objectContaining({
      method: "POST",
      headers: {
        Authorization: "Bearer supabase-user-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        issueId: issue.id,
        title: issue.title,
        body: issue.body,
        url: issue.html_url,
        repository: issue.repository_full_name,
        labels: ["help wanted"],
        language: "TypeScript",
      }),
    }));
  });

  it("surfaces API errors without hiding the server message", async () => {
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({
      error: "OpenRouter is not configured.",
    }), { status: 503, headers: { "Content-Type": "application/json" } }));

    await expect(generateContributionGuide(issue)).rejects.toThrow("OpenRouter is not configured.");
  });
});
