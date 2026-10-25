import { describe, expect, it } from "vitest";
import { getIssueMatch, rankIssues } from "../src/lib/matching";
import type { DeveloperProfile, GitHubIssue } from "../src/types/domain";

const profile: Pick<DeveloperProfile, "languages" | "skills" | "interests" | "experience_level"> = {
  languages: ["TypeScript"],
  skills: ["React", "testing"],
  interests: ["accessibility"],
  experience_level: "beginner",
};

const issue: GitHubIssue = {
  id: 101,
  number: 12,
  title: "Improve React accessibility tests",
  body: "## Expected behavior\nAdd a focused test for the accessible button name and keyboard behavior. Steps to reproduce are documented.",
  repository_full_name: "example/ui",
  html_url: "https://github.com/example/ui/issues/12",
  state: "open",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-10-24T00:00:00Z",
  closed_at: null,
  comments: 2,
  labels: [{ name: "good first issue" }],
  repository_url: "https://api.github.com/repos/example/ui",
  repository: "ui",
  owner: "example",
  language: "TypeScript",
};

describe("issue matching", () => {
  it("awards 100 for an exact match across all weighted components", () => {
    const exactIssue = {
      ...issue,
      title: "React TypeScript testing accessibility",
      body: "## Expected behavior\nAcceptance criteria: React TypeScript testing and accessibility work as expected. Steps to reproduce and test the change are included here with sufficient detail for maintainers.",
      labels: [{ name: "good first issue" }],
      updated_at: "2026-10-25T00:00:00Z",
    };
    const match = getIssueMatch(exactIssue, profile, Date.parse("2026-10-25T00:00:00Z"));
    expect(match.score).toBe(100);
    expect(match.factors.map(({ score }) => score)).toEqual([100, 100, 100, 100, 100]);
    expect(match.factors.map(({ weight }) => weight)).toEqual([35, 25, 15, 15, 10]);
    expect(match.factors.reduce((sum, factor) => sum + factor.points, 0)).toBe(100);
  });

  it("explains a score using normalized component scores and weighted points", () => {
    const match = getIssueMatch(issue, profile, Date.parse("2026-10-25T00:00:00Z"));
    expect(match.factors.map((factor) => factor.label)).toEqual([
      "Skill match",
      "Experience and difficulty fit",
      "Beginner-friendly labels",
      "Issue description clarity",
      "Freshness",
    ]);
    expect(match.factors.every((factor) => factor.score >= 0 && factor.score <= 100)).toBe(true);
    expect(match.factors.reduce((sum, factor) => sum + factor.weight, 0)).toBe(100);
    expect(match.factors.find((factor) => factor.label === "Beginner-friendly labels")?.score).toBe(100);
    expect(match.factors.find((factor) => factor.label === "Beginner-friendly labels")?.points).toBe(15);
    expect(match.factors.find((factor) => factor.label === "Experience and difficulty fit")?.explanation).toMatch(/imperfect hints/);
  });

  it("ranks the best overlapping issue first without modifying the input", () => {
    const unrelated = { ...issue, id: 202, title: "Update unrelated translation", labels: [] };
    const input = [unrelated, issue];
    expect(rankIssues(input, profile)[0].id).toBe(issue.id);
    expect(input[0].id).toBe(unrelated.id);
  });

  it("does not grant skill overlap for unrelated text", () => {
    const unrelated = {
      ...issue,
      title: "Update translations",
      body: "Fix spelling in a translated page.",
      labels: [],
      language: null,
    };
    const match = getIssueMatch(unrelated, profile, Date.parse("2026-10-25T00:00:00Z"));
    expect(match.factors[0].score).toBe(0);
    expect(match.score).toBeLessThan(getIssueMatch(issue, profile, Date.parse("2026-10-25T00:00:00Z")).score);
  });

  it("does not classify a generic help-wanted label as beginner-only", () => {
    const helpWantedIssue = { ...issue, labels: [{ name: "help wanted" }] };
    const match = getIssueMatch(helpWantedIssue, profile, Date.parse("2026-10-25T00:00:00Z"));
    expect(match.factors.find((factor) => factor.label === "Experience and difficulty fit")?.score).toBe(60);
    expect(match.factors.find((factor) => factor.label === "Beginner-friendly labels")?.score).toBe(40);
    expect(match.factors.find((factor) => factor.label === "Experience and difficulty fit")?.explanation).toMatch(/Difficulty is unknown/);
  });

  it("handles partial profile matches and missing issue metadata", () => {
    const partialProfile = {
      languages: ["TypeScript"],
      skills: ["React", "Rust"],
      interests: ["accessibility"],
      experience_level: "intermediate" as const,
    };
    const sparseIssue = {
      ...issue,
      title: "React rendering problem",
      body: null,
      labels: [],
      language: null,
      updated_at: "not-a-date",
    };
    const match = getIssueMatch(sparseIssue, partialProfile, Date.parse("2026-10-25T00:00:00Z"));
    expect(match.factors[0].score).toBe(25);
    expect(match.factors[0].explanation).toMatch(/Language metadata is unavailable/);
    expect(match.factors[1].score).toBe(60);
    expect(match.factors[1].explanation).toMatch(/Difficulty is unknown/);
    expect(match.factors[2].score).toBe(0);
    expect(match.factors[3].score).toBe(0);
    expect(match.factors[3].explanation).toMatch(/no description/i);
    expect(match.factors[4].score).toBe(50);
    expect(Number.isFinite(match.score)).toBe(true);
    expect(match.score).toBeGreaterThanOrEqual(0);
    expect(match.score).toBeLessThanOrEqual(100);
  });

  it("handles empty profiles, missing labels, and future update dates", () => {
    const emptyProfile = {
      languages: [],
      skills: [],
      interests: [],
      experience_level: "beginner" as const,
    };
    const sparseIssue = {
      ...issue,
      labels: undefined as unknown as GitHubIssue["labels"],
      body: null,
      updated_at: "2026-10-26T00:00:00Z",
      language: null,
    };
    const match = getIssueMatch(sparseIssue, emptyProfile, Date.parse("2026-10-25T00:00:00Z"));
    expect(match.factors[0].score).toBe(0);
    expect(match.factors[0].explanation).toMatch(/Add skills/);
    expect(match.factors[2].score).toBe(0);
    expect(match.factors[3].score).toBe(0);
    expect(match.factors[4].score).toBe(100);
    expect(match.score).toBe(25);
  });
});
