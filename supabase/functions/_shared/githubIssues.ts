export interface IssueSearchFilters {
  keywords?: unknown;
  language?: unknown;
  repository?: unknown;
  beginnerFriendly?: unknown;
  sort?: unknown;
  page?: unknown;
  perPage?: unknown;
}

export interface NormalizedGitHubIssue {
  id: number;
  title: string;
  body: string | null;
  repository_full_name: string;
  owner: string;
  repository: string;
  number: number;
  labels: Array<{ id?: number; name: string; color?: string; description?: string | null }>;
  html_url: string;
  state: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  comments: number;
  repository_url: string;
  language: string | null;
}

export interface GitHubIssueSearchResult {
  items: NormalizedGitHubIssue[];
  total_count: number;
  incomplete_results: boolean;
  page: number;
  perPage: number;
}

export class IssueSearchInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IssueSearchInputError";
  }
}

export class GitHubApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly rateLimited = false,
  ) {
    super(message);
    this.name = "GitHubApiError";
  }
}

export function clampPage(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) ? Math.min(50, Math.max(1, value)) : 1;
}

export function clampPerPage(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) ? Math.min(20, Math.max(1, value)) : 20;
}

export function buildIssueSearchQuery(input: IssueSearchFilters): { query: string; language: string | null } {
  const keywords =
    typeof input.keywords === "string"
      ? input.keywords.slice(0, 80).replace(/[^\p{L}\p{N}_+#. -]/gu, " ").trim()
      : "";
  const language = typeof input.language === "string" ? input.language.trim().slice(0, 32) : "";
  const repository = typeof input.repository === "string" ? input.repository.trim() : "";
  if (language && !/^[A-Za-z0-9+#.-]{1,32}$/.test(language)) {
    throw new IssueSearchInputError("Invalid language filter.");
  }
  if (repository && !/^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/.test(repository)) {
    throw new IssueSearchInputError("Repository must be formatted as owner/name.");
  }
  const terms = ["is:issue", "is:open"];
  if (keywords) terms.push(keywords);
  if (repository) terms.push(`repo:${repository}`);
  if (input.beginnerFriendly === true) {
    terms.push('(label:"good first issue" OR label:"help wanted" OR label:beginner OR label:easy OR label:first-timers-only)');
  }
  return { query: terms.join(" "), language: language || null };
}

export function normalizeGitHubIssue(value: unknown, language: string | null = null): NormalizedGitHubIssue {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    "pull_request" in value ||
    !("id" in value) ||
    typeof value.id !== "number" ||
    !Number.isSafeInteger(value.id) ||
    value.id < 1 ||
    !("number" in value) ||
    typeof value.number !== "number" ||
    !Number.isSafeInteger(value.number) ||
    value.number < 1 ||
    !("title" in value) ||
    typeof value.title !== "string" ||
    !("body" in value) ||
    (value.body !== null && typeof value.body !== "string") ||
    !("html_url" in value) ||
    typeof value.html_url !== "string" ||
    !value.html_url.startsWith("https://github.com/") ||
    !("state" in value) ||
    typeof value.state !== "string" ||
    !("created_at" in value) ||
    typeof value.created_at !== "string" ||
    !("updated_at" in value) ||
    typeof value.updated_at !== "string" ||
    !("closed_at" in value) ||
    (value.closed_at !== null && typeof value.closed_at !== "string") ||
    !("comments" in value) ||
    typeof value.comments !== "number" ||
    !("repository_url" in value) ||
    typeof value.repository_url !== "string" ||
    !value.repository_url.startsWith("https://api.github.com/repos/") ||
    !("labels" in value) ||
    !Array.isArray(value.labels) ||
    !value.labels.every((label) =>
      typeof label === "object" && label !== null && !Array.isArray(label) && "name" in label &&
      typeof label.name === "string"
    )
  ) {
    throw new GitHubApiError("GitHub returned invalid issue data.", 502);
  }

  const parts = value.repository_url.split("/").filter(Boolean);
  const owner = parts[parts.length - 2];
  const repository = parts[parts.length - 1];
  if (!owner || !repository) throw new GitHubApiError("GitHub returned invalid repository data.", 502);
  return {
    id: value.id,
    title: value.title,
    body: value.body,
    repository_full_name: `${owner}/${repository}`,
    owner,
    repository,
    number: value.number,
    labels: value.labels,
    html_url: value.html_url,
    state: value.state,
    created_at: value.created_at,
    updated_at: value.updated_at,
    closed_at: value.closed_at,
    comments: value.comments,
    repository_url: value.repository_url,
    language,
  };
}

function rateLimitMessage(response: Response): { message: string; rateLimited: boolean } {
  const remaining = response.headers.get("x-ratelimit-remaining");
  const retryAfter = response.headers.get("retry-after");
  const rateLimited = response.status === 429 || (response.status === 403 && (remaining === "0" || retryAfter !== null));
  if (!rateLimited) return { message: "GitHub denied the issue search request (HTTP 403).", rateLimited: false };

  const reset = response.headers.get("x-ratelimit-reset");
  const resetTime = reset ? new Date(Number(reset) * 1000).toLocaleTimeString() : null;
  return {
    message: resetTime
      ? `GitHub API rate limit reached. Try again after ${resetTime} or configure a server-side GITHUB_TOKEN.`
      : "GitHub API rate limit reached. Try again later or configure a server-side GITHUB_TOKEN.",
    rateLimited: true,
  };
}

export async function searchGitHubIssues(
  filters: IssueSearchFilters,
  options: { headers?: HeadersInit; fetcher?: typeof fetch } = {},
): Promise<GitHubIssueSearchResult> {
  const { query, language } = buildIssueSearchQuery(filters);
  const page = clampPage(filters.page);
  const perPage = clampPerPage(filters.perPage);
  const params = new URLSearchParams({ q: query, page: String(page), per_page: String(perPage) });
  if (filters.sort === "created" || filters.sort === "comments" || filters.sort === "updated") {
    params.set("sort", filters.sort);
    params.set("order", "desc");
  }

  let response: Response;
  try {
    response = await (options.fetcher ?? fetch)(
      `https://api.github.com/search/issues?${params.toString()}`,
      {
        headers: options.headers,
        signal: AbortSignal.timeout(12_000),
      },
    );
  } catch {
    throw new GitHubApiError("Could not connect to the GitHub API. Check your network and try again.", 502);
  }

  if (!response.ok) {
    const rateLimit = rateLimitMessage(response);
    if (rateLimit.rateLimited) throw new GitHubApiError(rateLimit.message, 429, true);
    if (response.status === 403) throw new GitHubApiError(rateLimit.message, 403);
    if (response.status === 422) throw new GitHubApiError("GitHub rejected the issue search query.", 400);
    throw new GitHubApiError(`GitHub issue search failed (HTTP ${response.status}).`, 502);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new GitHubApiError("GitHub returned invalid JSON for issue search.", 502);
  }
  if (
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload) ||
    !("items" in payload) ||
    !Array.isArray(payload.items) ||
    !("total_count" in payload) ||
    typeof payload.total_count !== "number" ||
    !Number.isSafeInteger(payload.total_count) ||
    payload.total_count < 0
  ) {
    throw new GitHubApiError("GitHub returned invalid issue search data.", 502);
  }

  const items = payload.items.map((item) => normalizeGitHubIssue(item));
  const incompleteResults = "incomplete_results" in payload && payload.incomplete_results === true;
  return {
    items,
    total_count: payload.total_count,
    incomplete_results: incompleteResults || Boolean(language),
    page,
    perPage,
  };
}
