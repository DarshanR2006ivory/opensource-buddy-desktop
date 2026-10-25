import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, errorResponse, isRecord, jsonResponse, validOwnerRepo } from "../_shared/http.ts";
import { fetchGitHub, githubHeaders, rateLimitMessage } from "../_shared/github.ts";
import {
  buildIssueSearchQuery,
  clampPage,
  clampPerPage,
  GitHubApiError,
  normalizeGitHubIssue,
  searchGitHubIssues,
} from "../_shared/githubIssues.ts";

function cacheIssue(issue: ReturnType<typeof normalizeGitHubIssue>) {
  return {
    id: issue.id,
    repository: issue.repository,
    owner: issue.owner,
    number: issue.number,
    title: issue.title,
    body: issue.body,
    html_url: issue.html_url,
    state: issue.state,
    labels: issue.labels,
    language: issue.language,
    comments: issue.comments,
    repository_url: issue.repository_url,
    created_at: issue.created_at,
    updated_at: issue.updated_at,
    closed_at: issue.closed_at,
    fetched_at: new Date().toISOString(),
  };
}

async function repositoryLanguage(
  client: ReturnType<typeof createClient>,
  owner: string,
  repository: string,
): Promise<string | null> {
  const { data: cached, error: cacheError } = await client
    .from("github_repositories")
    .select("language")
    .eq("owner", owner)
    .eq("repository", repository)
    .gt("fetched_at", new Date(Date.now() - 24 * 60 * 60_000).toISOString())
    .maybeSingle();
  if (cacheError) console.error("GitHub repository language cache read failed:", cacheError.message);
  if (cached) return cached.language;

  let response: Response;
  try {
    response = await fetchGitHub(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`);
  } catch (error) {
    console.error("GitHub repository language request failed:", error);
    throw new Error("Could not connect to GitHub to verify repository languages.");
  }
  if (response.status === 404) return null;
  if (response.status === 403 || response.status === 429) throw new Error(rateLimitMessage(response));
  if (!response.ok) throw new Error(`GitHub could not verify a repository language (HTTP ${response.status}).`);
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("GitHub returned invalid JSON for repository language data.");
  }
  if (!isRecord(payload) || (payload.language !== null && typeof payload.language !== "string")) {
    throw new Error("GitHub returned invalid repository language data.");
  }
  const language = payload.language;
  const { error: writeError } = await client.from("github_repositories").upsert({
    owner,
    repository,
    language,
    fetched_at: new Date().toISOString(),
  }, { onConflict: "owner,repository" });
  if (writeError) console.error("GitHub repository language cache write failed:", writeError.message);
  return language;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await mapper(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

async function readSearchCache(client: ReturnType<typeof createClient>, hash: string) {
  const { data, error } = await client
    .from("github_issue_search_cache")
    .select("issue_ids,total_count,incomplete_results,fetched_at")
    .eq("query_hash", hash)
    .gt("fetched_at", new Date(Date.now() - 5 * 60_000).toISOString())
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { data: rows, error: rowsError } = await client.from("github_issues").select("*").in("id", data.issue_ids);
  if (rowsError) throw rowsError;
  const byId = new Map((rows ?? []).map((row) => [row.id, row]));
  const ordered = data.issue_ids.flatMap((id) => {
    const row = byId.get(id);
    return row
      ? [{
          ...row,
          owner: row.owner,
          repository: row.repository,
          repository_full_name: `${row.owner}/${row.repository}`,
        }]
      : [];
  });
  if (ordered.length !== data.issue_ids.length) return null;
  return {
    items: ordered,
    total_count: data.total_count,
    incomplete_results: data.incomplete_results,
  };
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return errorResponse("Method not allowed.", 405);

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return errorResponse("Request body must be valid JSON.", 400);
  }
  if (!isRecord(input)) return errorResponse("Request body must be a JSON object.", 400);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return errorResponse("Issue cache service is not configured.", 503);
  const client = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const detailNumber = input.number;
  if (detailNumber !== undefined) {
    if (typeof input.owner !== "string" || typeof input.repo !== "string" || typeof detailNumber !== "number" ||
        !validOwnerRepo(input.owner, input.repo) || !Number.isSafeInteger(detailNumber) || detailNumber < 1) {
      return errorResponse("Provide a valid owner, repository, and issue number.", 400);
    }
    const { data: cached, error: cacheReadError } = await client
      .from("github_issues")
      .select("*")
      .eq("owner", input.owner)
      .eq("repository", input.repo)
      .eq("number", Number(detailNumber))
      .gt("fetched_at", new Date(Date.now() - 5 * 60_000).toISOString())
      .maybeSingle();
    if (cacheReadError) console.error("GitHub issue cache read failed:", cacheReadError.message);
    if (cached) return jsonResponse({
      issue: {
        ...cached,
        owner: cached.owner,
        repository: cached.repository,
        repository_full_name: `${cached.owner}/${cached.repository}`,
      },
    });

    let response: Response;
    try {
      response = await fetchGitHub(`/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/issues/${detailNumber}`);
    } catch (error) {
      console.error("GitHub issue request failed:", error);
      return errorResponse("Could not connect to the GitHub API. Check your network and try again.", 502);
    }
    if (!response.ok) {
      if (response.status === 403 || response.status === 429) return errorResponse(rateLimitMessage(response), 429);
      if (response.status === 404) return errorResponse("GitHub issue not found. It may be private or no longer available.", 404);
      return errorResponse(`GitHub could not load this issue (HTTP ${response.status}).`, 502);
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return errorResponse("GitHub returned invalid JSON for issue search.", 502);
    }
    let issue: ReturnType<typeof normalizeGitHubIssue>;
    try {
      issue = normalizeGitHubIssue(payload);
    } catch (error) {
      return errorResponse(error instanceof Error ? error.message : "GitHub returned invalid issue data.", 502);
    }
    const { error: writeError } = await client.from("github_issues").upsert(cacheIssue(issue), { onConflict: "id" });
    if (writeError) console.error("GitHub issue cache write failed:", writeError.message);
    return jsonResponse({
      issue,
      ...(writeError ? { cacheWarning: "The issue was fetched, but could not be cached." } : {}),
    });
  }

  let queryData: { query: string; language: string | null };
  try {
    queryData = buildIssueSearchQuery(input);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Invalid issue search filters.", 400);
  }
  const sort = input.sort === "created" || input.sort === "comments" || input.sort === "updated" ? input.sort : "best-match";
  const page = clampPage(input.page);
  const perPage = clampPerPage(input.perPage);
  const cacheKey = JSON.stringify([queryData.query, queryData.language, sort, page, perPage]);
  const hashBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(cacheKey));
  const cacheHash = Array.from(new Uint8Array(hashBytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
  try {
    const cached = await readSearchCache(client, cacheHash);
    if (cached) return jsonResponse({
      ...cached,
      candidate_count: cached.total_count,
      incomplete_results: cached.incomplete_results || Boolean(queryData.language),
      page,
      perPage,
      cached: true,
    });
  } catch (error) {
    console.error("GitHub search cache read failed:", error);
  }

  let searchResult: Awaited<ReturnType<typeof searchGitHubIssues>>;
  try {
    searchResult = await searchGitHubIssues({ ...input, sort, page, perPage }, { headers: githubHeaders() });
  } catch (error) {
    if (error instanceof GitHubApiError) return errorResponse(error.message, error.status);
    console.error("GitHub issue search request failed:", error);
    return errorResponse("Could not connect to the GitHub API. Check your network and try again.", 502);
  }
  const issues = searchResult.items;

  let verifiedIssues = issues;
  let languageByRepository = new Map<string, string | null>();
  if (queryData.language) {
    const repositoryKeys = [...new Set(issues.map((issue) => `${issue.owner}/${issue.repository}`))];
    let languages: Array<readonly [string, string | null]>;
    try {
      languages = await mapWithConcurrency(repositoryKeys, 5, async (key) => {
        const [owner, repository] = key.split("/");
        return [key, await repositoryLanguage(client, owner, repository)] as const;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not verify repository languages.";
      return errorResponse(message, message.startsWith("GitHub API rate limit reached") ? 429 : 502);
    }
    languageByRepository = new Map(languages);
    const normalizedFilter = queryData.language.toLocaleLowerCase();
    verifiedIssues = issues.map((issue) => ({
      ...issue,
      language: languageByRepository.get(`${issue.owner}/${issue.repository}`) ?? null,
    })).filter((issue) => issue.language?.toLocaleLowerCase() === normalizedFilter);
  }
  let cacheWarning = "";
  const cacheableIssues = issues.map((issue) => ({
    ...issue,
    language: languageByRepository.get(`${issue.owner}/${issue.repository}`) ?? null,
  }));
  const { error: issueWriteError } = await client.from("github_issues").upsert(cacheableIssues.map(cacheIssue), { onConflict: "id" });
  if (issueWriteError) {
    console.error("GitHub issue cache write failed:", issueWriteError.message);
    cacheWarning = "GitHub returned live results, but the issue cache could not be updated.";
  } else {
    const { error: searchWriteError } = await client.from("github_issue_search_cache").upsert({
      query_hash: cacheHash,
      issue_ids: verifiedIssues.map((issue) => issue.id),
      total_count: searchResult.total_count,
      incomplete_results: searchResult.incomplete_results,
      fetched_at: new Date().toISOString(),
    }, { onConflict: "query_hash" });
    if (searchWriteError) {
      console.error("GitHub search cache write failed:", searchWriteError.message);
      cacheWarning = "GitHub returned live results, but the search cache could not be updated.";
    }
  }
  return jsonResponse({
    items: verifiedIssues,
    total_count: searchResult.total_count,
    candidate_count: searchResult.total_count,
    incomplete_results: searchResult.incomplete_results,
    page,
    perPage,
    ...(cacheWarning ? { cacheWarning } : {}),
  });
});
