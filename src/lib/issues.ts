import { supabase } from "./supabase";
import type {
  ContributionGuide,
  GitHubIssue,
  IssueFilters,
  IssueSearchResult,
  SavedIssue,
  StoredContributionGuide,
} from "../types/domain";
import { getFunctionErrorMessage } from "./apiErrors";
import { readMentorApiResponse } from "./mentorApiResponse";

async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  if (!supabase) {
    throw new Error("Connect Supabase to search and save real GitHub issues.");
  }
  const { data, error } = await supabase.functions.invoke<T>(name, { body });
  if (error) {
    const message = await getFunctionErrorMessage(error.message, error.context);
    throw new Error(message || "The issue service could not complete the request.");
  }
  if (data == null) {
    throw new Error("The issue service returned an empty response.");
  }
  return data;
}

export async function searchIssues(filters: IssueFilters = {}): Promise<IssueSearchResult> {
  const result = await invoke<IssueSearchResult>("search-issues", { ...filters });
  if (!Array.isArray(result.items) || typeof result.total_count !== "number") {
    throw new Error("The issue service returned invalid search data.");
  }
  return result;
}

export async function getIssue(owner: string, repo: string, number: number): Promise<GitHubIssue> {
  const result = await invoke<{ issue: GitHubIssue }>("search-issues", { owner, repo, number });
  if (!result.issue || typeof result.issue.id !== "number") {
    throw new Error("The issue service returned invalid issue data.");
  }
  return result.issue;
}

export async function generateContributionGuide(
  issue: GitHubIssue,
): Promise<ContributionGuide> {
  if (!supabase) throw new Error("Connect Supabase before requesting an AI mentor guide.");
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error(`Could not verify your session: ${sessionError.message}`);
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error("Sign in to request an AI contribution guide.");

  let response: Response;
  try {
    response = await fetch("/api/ai-mentor", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        issueId: issue.id,
        title: issue.title,
        body: issue.body,
        url: issue.html_url,
        repository: issue.repository_full_name,
        labels: issue.labels.map((label) => label.name),
        language: issue.language,
      }),
    });
  } catch {
    throw new Error("Could not reach the AI mentor API. Check the connection and try again.");
  }
  const result = await readMentorApiResponse(response);
  if (!response.ok) {
    throw new Error(result.error || `The AI mentor API failed (HTTP ${response.status}).`);
  }
  const guide = result.guide;
  if (
    !guide ||
    typeof guide.summary !== "string" ||
    typeof guide.issue_explanation !== "string" ||
    typeof guide.expected_outcome !== "string" ||
    !Array.isArray(guide.possible_root_causes) ||
    !Array.isArray(guide.files_to_inspect) ||
    !Array.isArray(guide.implementation_steps) ||
    typeof guide.example_code !== "string" ||
    !Array.isArray(guide.test_commands) ||
    !Array.isArray(guide.edge_cases) ||
    !Array.isArray(guide.pull_request_checklist) ||
    typeof guide.context_note !== "string" ||
    guide.repository_verification !== "not_performed" ||
    guide.generated_by !== "ai" ||
    !guide.links ||
    guide.links.issue !== issue.html_url ||
    guide.links.repository !== `https://github.com/${issue.repository_full_name}`
  ) {
    throw new Error("The AI mentor API returned an incomplete guide.");
  }
  return guide;
}

export async function saveIssue(issue: GitHubIssue): Promise<void> {
  if (!supabase) throw new Error("Connect Supabase before saving issues.");
  const { data, error: authError } = await supabase.auth.getUser();
  if (authError) throw new Error(`Could not verify your session: ${authError.message}`);
  if (!data.user) throw new Error("Sign in to save issues.");
  const { error } = await supabase.from("saved_issues").upsert(
    { user_id: data.user.id, issue_id: issue.id, created_at: new Date().toISOString() },
    { onConflict: "user_id,issue_id" },
  );
  if (error) throw new Error(`Could not save or refresh saved issue: ${error.message}`);
}

export async function removeSavedIssue(issueId: number): Promise<void> {
  if (!supabase) throw new Error("Connect Supabase before removing saved issues.");
  const { data, error: authError } = await supabase.auth.getUser();
  if (authError) throw new Error(`Could not verify your session: ${authError.message}`);
  if (!data.user) throw new Error("Sign in to remove saved issues.");
  const { error } = await supabase
    .from("saved_issues")
    .delete()
    .eq("user_id", data.user.id)
    .eq("issue_id", issueId);
  if (error) throw new Error(`Could not remove saved issue: ${error.message}`);
}

export async function listSavedIssues(): Promise<SavedIssue[]> {
  if (!supabase) throw new Error("Connect Supabase to load saved issues.");
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError) throw new Error(`Could not verify your session: ${authError.message}`);
  if (!userData.user) throw new Error("Sign in to view saved issues.");
  const { data: saved, error } = await supabase
    .from("saved_issues")
    .select("issue_id,created_at")
    .eq("user_id", userData.user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load saved issues: ${error.message}`);
  if (!saved?.length) return [];
  const [{ data: issues, error: issueError }, { data: progress, error: progressError }] = await Promise.all([
    supabase
      .from("github_issues")
      .select("*")
      .in("id", saved.map((row) => row.issue_id)),
    supabase
      .from("contribution_progress")
      .select("issue_id,status,updated_at")
      .eq("user_id", userData.user.id)
      .in("issue_id", saved.map((row) => row.issue_id)),
  ]);
  if (issueError) throw new Error(`Could not load saved issue details: ${issueError.message}`);
  if (progressError) throw new Error(`Could not load contribution progress: ${progressError.message}`);
  const byId = new Map((issues ?? []).map((issue) => [issue.id, mapCachedIssue(issue)]));
  const progressById = new Map((progress ?? []).map((row) => [row.issue_id, row]));
  return saved.flatMap((row) => {
    const issue = byId.get(row.issue_id);
    const currentProgress = progressById.get(row.issue_id);
    return issue
      ? [{
          issue,
          status: (currentProgress?.status ?? "saved") as SavedIssue["status"],
          updatedAt: currentProgress?.updated_at ?? row.created_at,
        }]
      : [];
  });
}

export async function updateIssueProgress(
  issueId: number,
  status: SavedIssue["status"],
): Promise<void> {
  if (!supabase) throw new Error("Connect Supabase before updating progress.");
  const { data, error: authError } = await supabase.auth.getUser();
  if (authError) throw new Error(`Could not verify your session: ${authError.message}`);
  if (!data.user) throw new Error("Sign in to update progress.");
  const { error } = await supabase.from("contribution_progress").upsert(
    { user_id: data.user.id, issue_id: issueId, status, updated_at: new Date().toISOString() },
    { onConflict: "user_id,issue_id" },
  );
  if (error) throw new Error(`Could not update progress: ${error.message}`);
}

export async function removeIssueProgress(issueId: number): Promise<void> {
  if (!supabase) throw new Error("Connect Supabase before removing progress.");
  const { data, error: authError } = await supabase.auth.getUser();
  if (authError) throw new Error(`Could not verify your session: ${authError.message}`);
  if (!data.user) throw new Error("Sign in to remove issue progress.");
  const { error } = await supabase
    .from("contribution_progress")
    .delete()
    .eq("user_id", data.user.id)
    .eq("issue_id", issueId);
  if (error) throw new Error(`Could not remove issue progress: ${error.message}`);
}

export async function listContributionGuides(): Promise<StoredContributionGuide[]> {
  if (!supabase) throw new Error("Connect Supabase to load contribution guides.");
  const { data, error: authError } = await supabase.auth.getUser();
  if (authError) throw new Error(`Could not verify your session: ${authError.message}`);
  if (!data.user) throw new Error("Sign in to view contribution guides.");
  const { data: guides, error } = await supabase
    .from("contribution_guides")
    .select("id,issue_id,guide,model,generated_at")
    .eq("user_id", data.user.id)
    .order("generated_at", { ascending: false });
  if (error) throw new Error(`Could not load contribution guides: ${error.message}`);
  return (guides ?? []).map((row) => ({
    id: row.id,
    issue_id: Number(row.issue_id),
    guide: row.guide as ContributionGuide,
    model: row.model,
    generated_at: row.generated_at,
  }));
}

export async function updateContributionGuide(
  guideId: string,
  guide: ContributionGuide,
): Promise<void> {
  if (!supabase) throw new Error("Connect Supabase to update contribution guides.");
  const { data, error: authError } = await supabase.auth.getUser();
  if (authError) throw new Error(`Could not verify your session: ${authError.message}`);
  if (!data.user) throw new Error("Sign in to update contribution guides.");
  const { data: updated, error } = await supabase
    .from("contribution_guides")
    .update({ guide })
    .eq("id", guideId)
    .eq("user_id", data.user.id)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`Could not update contribution guide: ${error.message}`);
  if (!updated) throw new Error("Contribution guide was not found in your account.");
}

export async function deleteContributionGuide(guideId: string): Promise<void> {
  if (!supabase) throw new Error("Connect Supabase to delete contribution guides.");
  const { data, error: authError } = await supabase.auth.getUser();
  if (authError) throw new Error(`Could not verify your session: ${authError.message}`);
  if (!data.user) throw new Error("Sign in to delete contribution guides.");
  const { error } = await supabase
    .from("contribution_guides")
    .delete()
    .eq("id", guideId)
    .eq("user_id", data.user.id);
  if (error) throw new Error(`Could not delete contribution guide: ${error.message}`);
}

export function mapCachedIssue(row: Record<string, unknown>): GitHubIssue {
  return {
    id: Number(row.id),
    number: Number(row.number),
    title: String(row.title),
    body: typeof row.body === "string" ? row.body : null,
    repository_full_name:
      typeof row.repository_full_name === "string"
        ? row.repository_full_name
        : `${String(row.owner)}/${String(row.repository)}`,
    html_url: String(row.html_url),
    state: String(row.state),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    closed_at: typeof row.closed_at === "string" ? row.closed_at : null,
    comments: Number(row.comments ?? 0),
    labels: Array.isArray(row.labels) ? (row.labels as GitHubIssue["labels"]) : [],
    repository_url: String(row.repository_url ?? ""),
    repository: String(row.repository),
    owner: String(row.owner),
    language: typeof row.language === "string" ? row.language : null,
  };
}
