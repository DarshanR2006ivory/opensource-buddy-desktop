import type { DeveloperProfile, GitHubIssue, IssueMatch, ScoreFactor } from "../types/domain";

const weights = {
  skill: 35,
  experience: 25,
  beginnerLabels: 15,
  clarity: 15,
  freshness: 10,
} as const;

const beginnerLabels = ["good first issue", "beginner", "first-timers-only", "easy", "first issue"];
const intermediateLabels = ["intermediate", "medium", "moderate"];
const advancedLabels = ["advanced", "hard", "difficult", "expert"];
const helpWantedLabels = ["help wanted"];

function normalize(value: string): string {
  return value.toLocaleLowerCase().replace(/[^a-z0-9+#.]+/g, " ").trim();
}

function includesTerm(haystack: string, term: string): boolean {
  const normalizedTerm = normalize(term);
  const normalizedText = ` ${normalize(haystack)} `;
  return normalizedTerm.length > 1 && normalizedText.includes(` ${normalizedTerm} `);
}

function list(values: string[] | null | undefined): string[] {
  return Array.isArray(values)
    ? [...new Set(values.filter((value) => typeof value === "string").map((value) => value.trim()).filter(Boolean))]
    : [];
}

function labelMatch(labels: string[], candidates: string[]): string | undefined {
  return labels.find((label) => candidates.some((candidate) => includesTerm(label, candidate)));
}

function detectDifficulty(labels: string[]): "beginner" | "intermediate" | "advanced" | "unknown" {
  const signals = [
    labelMatch(labels, beginnerLabels) ? "beginner" : null,
    labelMatch(labels, intermediateLabels) ? "intermediate" : null,
    labelMatch(labels, advancedLabels) ? "advanced" : null,
  ].filter((signal): signal is "beginner" | "intermediate" | "advanced" => signal !== null);
  return signals.length === 1 ? signals[0] : "unknown";
}

function skillMatch(
  issue: GitHubIssue,
  profile: Pick<DeveloperProfile, "languages" | "skills" | "interests">,
): { score: number; matched: string[]; terms: string[]; explanation: string } {
  const languages = list(profile.languages);
  const skills = list(profile.skills);
  const interests = list(profile.interests);
  const issueLanguage = typeof issue.language === "string" && issue.language.trim() ? issue.language.trim() : null;
  const text = `${issue.title} ${issue.body ?? ""} ${issue.repository_full_name ?? `${issue.owner}/${issue.repository}`} ${issue.labels?.map((label) => label.name).join(" ") ?? ""}`;
  const languageMatches = languages.filter((language) =>
    issueLanguage
      ? issueLanguage.toLocaleLowerCase() === language.toLocaleLowerCase()
      : includesTerm(text, language),
  );
  const otherTerms = [...new Set([...skills, ...interests])];
  const matchedOtherTerms = otherTerms.filter((term) => includesTerm(text, term));
  const terms = [...new Set([...languages, ...otherTerms])];
  const matched = [...new Set([...languageMatches, ...matchedOtherTerms])];
  const score = terms.length === 0 ? 0 : Math.round((matched.length / terms.length) * 100);
  const explanation = matched.length
    ? `Matched profile terms: ${matched.join(", ")}.${issueLanguage ? "" : " Language metadata is unavailable, so programming-language matches use issue text only."}`
    : terms.length
      ? `No profile terms matched the issue text${issueLanguage ? ` or its ${issueLanguage} language metadata` : ""}.`
      : "Add skills, programming languages, or interests to personalize this component.";
  return { score, matched, terms, explanation };
}

function experienceFit(
  experience: DeveloperProfile["experience_level"] | undefined,
  difficulty: ReturnType<typeof detectDifficulty>,
): { score: number; explanation: string } {
  if (difficulty === "unknown") {
    return {
      score: 60,
      explanation: "Difficulty is unknown; this neutral estimate does not infer suitability from missing labels.",
    };
  }
  const level = experience === "beginner" || experience === "intermediate" || experience === "advanced"
    ? experience
    : "intermediate";
  const scores = {
    beginner: { beginner: 100, intermediate: 70, advanced: 45 },
    intermediate: { beginner: 50, intermediate: 100, advanced: 75 },
    advanced: { beginner: 20, intermediate: 60, advanced: 100 },
  } as const;
  return {
    score: scores[level][difficulty],
    explanation: `The "${difficulty}" label signal is compared with your ${level} experience preference. Labels are imperfect hints, not a reliable measure of issue difficulty.`,
  };
}

function beginnerLabelScore(labels: string[]): { score: number; explanation: string } {
  const beginnerLabel = labelMatch(labels, beginnerLabels);
  if (beginnerLabel) {
    return {
      score: 100,
      explanation: `Recognized beginner-friendly label: "${beginnerLabel}". Labels are maintainer-defined signals and do not guarantee the work is beginner-friendly.`,
    };
  }
  const helpWantedLabel = labelMatch(labels, helpWantedLabels);
  if (helpWantedLabel) {
    return {
      score: 40,
      explanation: `"${helpWantedLabel}" invites contributions but does not describe the issue's difficulty.`,
    };
  }
  return { score: 0, explanation: "No recognized beginner-friendly label is present." };
}

function descriptionClarity(body: string | null | undefined): { score: number; explanation: string } {
  if (typeof body !== "string" || body.trim().length === 0) {
    return { score: 0, explanation: "The issue has no description to assess." };
  }
  const signals: string[] = [];
  let score = body.length < 40 ? 20 : body.length < 120 ? 40 : 60;
  if (/(^|\n)\s{0,3}#{1,6}\s+\S/m.test(body)) {
    score += 15;
    signals.push("section headings");
  }
  if (/\b(expected behavior|acceptance criteria|steps to reproduce|definition of done)\b/i.test(body)) {
    score += 15;
    signals.push("explicit requirements");
  }
  if (/\b(steps|reproduce|test|tests|example|screenshot|log|error message)\b/i.test(body)) {
    score += 10;
    signals.push("actionable details");
  }
  const normalizedScore = Math.min(100, score);
  return {
    score: normalizedScore,
    explanation: signals.length
      ? `Description length and ${signals.join(", ")} suggest ${normalizedScore >= 70 ? "useful" : "some"} context. This is a text heuristic, not a maintainer review.`
      : `Description length suggests limited context (${normalizedScore}/100 heuristic score); confirm requirements with maintainers.`,
  };
}

function freshness(updatedAt: string | null | undefined, now: number): { score: number; explanation: string } {
  if (typeof updatedAt !== "string") return { score: 50, explanation: "Update date is unavailable; freshness uses a neutral estimate." };
  const timestamp = Date.parse(updatedAt);
  if (!Number.isFinite(timestamp)) return { score: 50, explanation: "Update date is invalid; freshness uses a neutral estimate." };
  const ageDays = Math.max(0, (now - timestamp) / 86_400_000);
  const score = ageDays <= 7 ? 100 : ageDays <= 30 ? 80 : ageDays <= 90 ? 60 : ageDays <= 180 ? 35 : 10;
  return { score, explanation: `Last updated ${Math.floor(ageDays)} day(s) ago; newer activity scores higher.` };
}

function factor(label: string, weight: number, score: number, explanation: string): ScoreFactor {
  const normalizedScore = Math.min(100, Math.max(0, Math.round(score)));
  return {
    label,
    score: normalizedScore,
    weight,
    points: Math.round(normalizedScore * weight) / 100,
    explanation,
  };
}

export function getIssueMatch(
  issue: GitHubIssue,
  profile: Pick<DeveloperProfile, "languages" | "skills" | "interests" | "experience_level">,
  now = Date.now(),
): IssueMatch {
  const labels = Array.isArray(issue.labels)
    ? issue.labels.filter((label) => label && typeof label.name === "string").map((label) => label.name.toLocaleLowerCase())
    : [];
  const difficulty = detectDifficulty(labels);
  const skill = skillMatch(issue, profile);
  const experience = experienceFit(profile.experience_level, difficulty);
  const beginner = beginnerLabelScore(labels);
  const clarity = descriptionClarity(issue.body);
  const fresh = freshness(issue.updated_at, now);

  const factors = [
    factor("Skill match", weights.skill, skill.score, skill.explanation),
    factor("Experience and difficulty fit", weights.experience, experience.score, experience.explanation),
    factor("Beginner-friendly labels", weights.beginnerLabels, beginner.score, beginner.explanation),
    factor("Issue description clarity", weights.clarity, clarity.score, clarity.explanation),
    factor("Freshness", weights.freshness, fresh.score, fresh.explanation),
  ];

  const score = Math.min(100, Math.max(0, Math.round(factors.reduce((total, item) => total + item.points, 0))));
  return { score, factors };
}

export function rankIssues(
  issues: GitHubIssue[],
  profile: Pick<DeveloperProfile, "languages" | "skills" | "interests" | "experience_level">,
): GitHubIssue[] {
  const now = Date.now();
  return issues
    .map((issue) => ({ issue, score: getIssueMatch(issue, profile, now).score }))
    .sort((left, right) => right.score - left.score)
    .map(({ issue }) => issue);
}
