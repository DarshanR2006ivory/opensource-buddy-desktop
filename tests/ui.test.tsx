import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IssueCard } from "../src/components/IssueCard";
import type { GitHubIssue } from "../src/types/domain";

vi.mock("../src/app/AuthContext", () => ({
  useAuth: () => ({ user: null }),
}));

const exampleIssue: GitHubIssue = {
  id: 55,
  number: 4,
  title: "Add accessible keyboard navigation",
  body: "The menu should support keyboard navigation and have a clear accessible label. Include a focused test for expected behavior.",
  repository_full_name: "example/menu",
  html_url: "https://github.com/example/menu/issues/4",
  state: "open",
  created_at: "2026-10-20T00:00:00Z",
  updated_at: "2026-10-24T00:00:00Z",
  closed_at: null,
  comments: 1,
  labels: [{ name: "good first issue" }],
  repository_url: "https://api.github.com/repos/example/menu",
  repository: "menu",
  owner: "example",
  language: "TypeScript",
};

const exampleProfile = {
  id: "user-1",
  languages: ["TypeScript"],
  skills: ["accessibility"],
  interests: ["web"],
  project_types: ["libraries"],
  experience_level: "beginner" as const,
  github_username: null,
  updated_at: "2026-10-25T00:00:00Z",
};

describe("issue card", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the issue match breakdown and does not promise suitability", () => {
    render(
      <MemoryRouter>
        <IssueCard issue={exampleIssue} profile={exampleProfile} showBreakdown />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Why this matches you/)).toBeInTheDocument();
    expect(screen.getByText(/not a guarantee that an issue is suitable/i)).toBeInTheDocument();
    expect(screen.getByText("Beginner-friendly labels")).toBeInTheDocument();
    expect(screen.getByText("Labels: 100")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /github/i })).toHaveAttribute("href", exampleIssue.html_url);
    expect(screen.getByRole("link", { name: /ask ai mentor/i })).toHaveAttribute(
      "href",
      "/mentor/example/menu/4?generate=1",
    );
    expect(screen.getByRole("link", { name: "example/menu" })).toHaveAttribute(
      "href",
      "https://github.com/example/menu",
    );
  });
});
