import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IssueDetailPage } from "../src/pages/IssueDetailPage";
import type { GitHubIssue } from "../src/types/domain";

const mocks = vi.hoisted(() => ({
  getIssue: vi.fn(),
}));

vi.mock("../src/app/AuthContext", () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock("../src/lib/issues", () => ({
  getIssue: mocks.getIssue,
  saveIssue: vi.fn(),
}));

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

describe("issue detail mentor action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getIssue.mockResolvedValue(issue);
  });

  it("offers AI Mentor from the issue detail, including for signed-out visitors", async () => {
    render(
      <MemoryRouter initialEntries={["/issues/example/menu/4"]}>
        <Routes>
          <Route path="/issues/:owner/:repo/:number" element={<IssueDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("link", { name: /ask ai mentor/i })).toHaveAttribute(
      "href",
      "/mentor/example/menu/4?generate=1",
    );
  });
});
