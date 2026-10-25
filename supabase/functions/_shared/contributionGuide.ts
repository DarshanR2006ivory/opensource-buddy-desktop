export interface ContributionGuideSources {
  owner: string;
  repo: string;
  number: number;
  title: string;
  body: string | null;
  htmlUrl: string;
  readmeAvailable: boolean;
  contributingPath: string | null;
}

export interface ContributionGuideLinks {
  issue: string;
  repository: string;
  readme: string | null;
  contributing: string | null;
}

export interface ContributionGuideContent {
  summary: string;
  prerequisites: string[];
  setup: string[];
  steps: string[];
  files_to_investigate: string[];
  testing: string[];
  pull_request: string[];
  verify: string[];
  source_notes: string[];
  links: ContributionGuideLinks;
  generated_by: "ai" | "fallback";
}

export function buildGuideLinks(sources: ContributionGuideSources): ContributionGuideLinks {
  const repository = `https://github.com/${encodeURIComponent(sources.owner)}/${encodeURIComponent(sources.repo)}`;
  return {
    issue: sources.htmlUrl,
    repository,
    readme: sources.readmeAvailable ? `${repository}#readme` : null,
    contributing: sources.contributingPath
      ? `${repository}/blob/HEAD/${sources.contributingPath.split("/").map(encodeURIComponent).join("/")}`
      : null,
  };
}

export function filterSupportedFileSuggestions(suggestions: unknown, sourceText: string): string[] {
  if (!Array.isArray(suggestions) || typeof sourceText !== "string") return [];
  const supportedPaths = [...sourceText.matchAll(/(?:^|[\s`"'(])((?:[\w.-]+\/)*[\w.-]+\.[a-z0-9]+|(?:[\w.-]+\/)+[\w.-]+)/gi)]
    .map((match) => match[1].toLocaleLowerCase());
  return suggestions.filter((suggestion): suggestion is string =>
    typeof suggestion === "string" &&
    supportedPaths.some((path) => suggestion.toLocaleLowerCase().includes(path))
  );
}

export function buildFallbackGuide(sources: ContributionGuideSources): ContributionGuideContent {
  const issueText = sources.body?.trim();
  const summary = issueText
    ? `In plain English, this issue is about: ${sources.title}\n\nThe issue description (shown without reinterpretation) says:\n\n${issueText.slice(0, 1800)}${issueText.length > 1800 ? "…" : ""}`
    : `The issue is titled “${sources.title}”, but it does not include a description. Read the discussion and ask the maintainers to clarify the expected behavior before starting.`;
  const setup = [
    "Read the linked repository README and contribution guidelines first; follow their current setup and coding instructions.",
    "If those documents do not explain how to set up the project, inspect the repository's top-level files and ask maintainers before installing tools or running commands.",
    "Fork the repository on GitHub, clone your fork, and create a focused branch for this issue. Use only commands documented by the project.",
  ];
  const sourceNotes = [
    `Live GitHub issue: ${sources.htmlUrl}`,
    sources.readmeAvailable
      ? "The repository README was available from GitHub."
      : "No repository README was available from GitHub; project setup commands are not known.",
    sources.contributingPath
      ? `Contribution guidance was available at ${sources.contributingPath}.`
      : "No CONTRIBUTING.md was found in the checked repository locations.",
    "No specific code files can be recommended from the available issue and repository information.",
  ];
  return {
    summary,
    prerequisites: [
      "The issue does not list required skills or tools. Review the repository documentation and issue discussion to identify project-specific prerequisites.",
      "Git and a GitHub account are needed for the standard fork-and-pull-request workflow; install project tools only when the repository documents them.",
    ],
    setup,
    steps: [
      "Read the original issue and its discussion; confirm the expected outcome and ask for clarification if the description is incomplete.",
      "Review the README and contribution guidelines, then set up the project using only documented instructions.",
      "Explore the repository structure and trace the behavior described by the issue before choosing files to edit.",
      "Make the smallest focused change that addresses the agreed behavior, following the project's conventions.",
      "Run the checks documented by the project and review your diff for unrelated changes.",
    ],
    files_to_investigate: [],
    testing: [
      "Run the tests and checks explicitly documented by the repository; no project-specific test command was inferred.",
      "Add or update a focused test for the issue's expected behavior when the repository's test setup is known.",
      "Manually verify the changed behavior and check for regressions in nearby functionality.",
      "If setup or test instructions are unavailable, ask maintainers how they validate contributions.",
    ],
    pull_request: [
      "Push your focused branch to your GitHub fork.",
      "Open a pull request against the project's target branch and link the original issue.",
      "Explain the change, summarize the checks you ran, and include screenshots or logs when they help reviewers.",
      "Respond to review feedback and update the pull request until maintainers approve or merge it.",
    ],
    verify: [
      "Check the linked issue and its latest discussion for changes in scope or ownership.",
      "Follow the repository's current contribution instructions; they take precedence over this fallback guide.",
      "The available context does not identify specific code files, required tools, or project commands; confirm these with the repository before proceeding.",
    ],
    source_notes: sourceNotes,
    links: buildGuideLinks(sources),
    generated_by: "fallback",
  };
}
