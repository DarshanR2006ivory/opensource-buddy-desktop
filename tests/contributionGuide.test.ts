import { describe, expect, it } from "vitest";
import { buildFallbackGuide, filterSupportedFileSuggestions } from "../supabase/functions/_shared/contributionGuide";

const sources = {
  owner: "example",
  repo: "sample-project",
  number: 42,
  title: "Document keyboard navigation behavior",
  body: "Add keyboard navigation to the menu and include a focused test.",
  htmlUrl: "https://github.com/example/sample-project/issues/42",
  readmeAvailable: false,
  contributingPath: null,
};

describe("contribution guide fallback", () => {
  it("provides every guide section while keeping unknown project details unspecified", () => {
    const guide = buildFallbackGuide(sources);

    expect(guide.generated_by).toBe("fallback");
    expect(guide.summary).toContain(sources.title);
    expect(guide.summary).toContain(sources.body);
    expect(guide.prerequisites.length).toBeGreaterThan(0);
    expect(guide.setup.length).toBeGreaterThan(0);
    expect(guide.steps.length).toBeGreaterThan(0);
    expect(guide.files_to_investigate).toEqual([]);
    expect(guide.testing.length).toBeGreaterThan(0);
    expect(guide.pull_request.length).toBeGreaterThan(0);
    expect(guide.links).toEqual({
      issue: sources.htmlUrl,
      repository: "https://github.com/example/sample-project",
      readme: null,
      contributing: null,
    });
    expect(guide.source_notes.join(" ")).toMatch(/no repository README/i);
    expect(guide.source_notes.join(" ")).toMatch(/no specific code files/i);
    expect(guide.setup.join(" ")).not.toMatch(/\b(npm|yarn|pnpm|pip|cargo|go test)\b/i);
  });

  it("states when the issue description is missing and links only available repository docs", () => {
    const guide = buildFallbackGuide({
      ...sources,
      body: null,
      readmeAvailable: true,
      contributingPath: ".github/CONTRIBUTING.md",
    });

    expect(guide.summary).toMatch(/does not include a description/i);
    expect(guide.links.readme).toBe("https://github.com/example/sample-project#readme");
    expect(guide.links.contributing).toBe(
      "https://github.com/example/sample-project/blob/HEAD/.github/CONTRIBUTING.md",
    );
    expect(guide.verify.join(" ")).toMatch(/confirm these with the repository/i);
  });

  it("keeps AI file suggestions only when the source text explicitly mentions their paths", () => {
    expect(filterSupportedFileSuggestions(
      ["Review src/menu/keyboard.ts for the documented behavior.", "Try editing src/guessed.ts."],
      "The README describes src/menu/keyboard.ts as the keyboard navigation implementation.",
    )).toEqual(["Review src/menu/keyboard.ts for the documented behavior."]);
  });
});
