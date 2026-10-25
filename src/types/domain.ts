export type ExperienceLevel = "beginner" | "intermediate" | "advanced";

export interface DeveloperProfile {
  id: string;
  languages: string[];
  skills: string[];
  experience_level: ExperienceLevel;
  interests: string[];
  project_types: string[];
  github_username: string | null;
  updated_at: string;
}

export interface GitHubLabel {
  id?: number;
  name: string;
  color?: string;
  description?: string | null;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  repository_full_name: string;
  html_url: string;
  state: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  comments: number;
  labels: GitHubLabel[];
  repository_url: string;
  repository: string;
  owner: string;
  language: string | null;
}

export type IssueSort = "match" | "updated" | "created" | "comments";

export interface IssueFilters {
  keywords?: string;
  language?: string;
  beginnerFriendly?: boolean;
  repository?: string;
  sort?: IssueSort;
  page?: number;
  perPage?: number;
}

export interface IssueSearchResult {
  items: GitHubIssue[];
  total_count: number;
  candidate_count?: number;
  incomplete_results: boolean;
  page: number;
  perPage: number;
  cacheWarning?: string;
}

export interface ScoreFactor {
  label: string;
  /** Normalized component score, always 0-100. */
  score: number;
  /** Percentage of the overall score assigned to this component. */
  weight: number;
  /** Weighted points this component contributes to the overall score. */
  points: number;
  explanation: string;
}

export interface IssueMatch {
  score: number;
  factors: ScoreFactor[];
}

export interface SavedIssue {
  issue: GitHubIssue;
  status: "saved" | "in_progress" | "completed";
  updatedAt: string;
}

export interface StoredContributionGuide {
  id: string;
  issue_id: number;
  guide: ContributionGuide;
  model: string;
  generated_at: string;
}

export interface ContributionGuide {
  summary: string;
  prerequisites: string[];
  setup: string[];
  steps: string[];
  files_to_investigate: string[];
  testing: string[];
  pull_request: string[];
  verify: string[];
  source_notes: string[];
  links: {
    issue: string;
    repository: string;
    readme: string | null;
    contributing: string | null;
  };
  generated_by: "ai" | "fallback";
}
