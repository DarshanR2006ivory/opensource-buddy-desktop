import { useEffect, useState, type FormEvent } from "react";
import { IssueCard } from "../components/IssueCard";
import { Button, EmptyState, LoadingState, Notice, PageTitle } from "../components/ui";
import { searchIssues } from "../lib/issues";
import { getProfile } from "../lib/profile";
import { rankIssues } from "../lib/matching";
import { useAuth } from "../app/AuthContext";
import type { DeveloperProfile, GitHubIssue, IssueFilters, IssueSort } from "../types/domain";

const languages = [
  "Assembly", "C", "C#", "C++", "Clojure", "Dart", "Elixir", "Erlang", "F#", "Go",
  "Haskell", "Java", "JavaScript", "Julia", "Kotlin", "Lua", "Objective-C", "Perl",
  "PHP", "Python", "R", "Ruby", "Rust", "Scala", "Shell", "Solidity", "Swift",
  "TypeScript", "Visual Basic",
];

export function ExplorerPage() {
  const { user } = useAuth();
  const [keywords, setKeywords] = useState("");
  const [language, setLanguage] = useState("");
  const [repository, setRepository] = useState("");
  const [beginnerFriendly, setBeginnerFriendly] = useState(false);
  const [sort, setSort] = useState<IssueSort>("match");
  const [applied, setApplied] = useState<IssueFilters>({ perPage: 20, page: 1, sort: "match" });
  const [issues, setIssues] = useState<GitHubIssue[]>([]);
  const [total, setTotal] = useState(0);
  const [profile, setProfile] = useState<DeveloperProfile | null>(null);
  const [profileError, setProfileError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cacheWarning, setCacheWarning] = useState("");

  useEffect(() => {
    if (!user) return;
    void getProfile(user)
      .then(setProfile)
      .catch((reason: unknown) => setProfileError(reason instanceof Error ? reason.message : "Could not load your profile."));
  }, [user]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void searchIssues(applied)
      .then((result) => {
        if (!active) return;
        setIssues(result.items);
        setTotal(result.candidate_count ?? result.total_count);
        setCacheWarning(result.cacheWarning ?? "");
      })
      .catch((reason: unknown) => {
        if (active) {
          setIssues([]);
          setTotal(0);
          setError(reason instanceof Error ? reason.message : "Could not search GitHub issues.");
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [applied]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setApplied({
      keywords: keywords.trim(),
      language: language || undefined,
      repository: repository.trim() || undefined,
      beginnerFriendly,
      sort,
      page: 1,
      perPage: 20,
    });
  }

  const visibleIssues = sort === "match" && profile ? rankIssues(issues, profile) : issues;
  const page = applied.page ?? 1;
  const pageCount = Math.min(50, Math.max(1, Math.ceil(total / (applied.perPage ?? 20))));

  return (
    <>
      <PageTitle eyebrow="GitHub issue explorer" title="Find an issue worth your time" description="Search open issues from public repositories. Filter by language, beginner-friendly signals, keywords, or a specific repository." />
      {profileError && <Notice>{profileError} You can still search public issues without personalized scores.</Notice>}
      <form className="filter-panel" onSubmit={submitSearch}>
        <div className="field">
          <label htmlFor="keywords">Issue keywords</label>
          <input className="filter-input" id="keywords" value={keywords} onChange={(event) => setKeywords(event.target.value)} placeholder="e.g. accessibility, documentation" maxLength={80} />
        </div>
        <div className="field">
          <label htmlFor="language">Language</label>
          <input className="filter-input" id="language" list="language-options" value={language} onChange={(event) => setLanguage(event.target.value)} placeholder="Any language" maxLength={32} />
          <datalist id="language-options">{languages.map((item) => <option key={item} value={item} />)}</datalist>
        </div>
        <div className="field">
          <label htmlFor="repository">Repository</label>
          <input className="filter-input" id="repository" value={repository} onChange={(event) => setRepository(event.target.value)} placeholder="owner/repository" maxLength={100} />
        </div>
        <div className="field">
          <label htmlFor="sort">Sort by</label>
          <select className="filter-select" id="sort" value={sort} onChange={(event) => setSort(event.target.value as IssueSort)}>
            <option value="match">Best match</option>
            <option value="updated">Recently updated</option>
            <option value="created">Newest</option>
            <option value="comments">Most discussed</option>
          </select>
        </div>
        <label className="filter-check">
          <input type="checkbox" checked={beginnerFriendly} onChange={(event) => setBeginnerFriendly(event.target.checked)} />
          Beginner-friendly labels
        </label>
        <Button type="submit">Search issues</Button>
      </form>
      {cacheWarning && <Notice>{cacheWarning}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      <div className="results-line">
        <span>
          {loading
            ? "Searching GitHub..."
            : applied.language
              ? `${issues.length} verified ${applied.language} issue${issues.length === 1 ? "" : "s"} on this page · ${total.toLocaleString()} GitHub candidates before language filtering`
              : `${total.toLocaleString()} matching issue${total === 1 ? "" : "s"}`}
        </span>
        <span>{profile ? "Issue scores use your profile; no score guarantees suitability." : "Sign in and add a profile for personalized match scores."}</span>
      </div>
      {loading ? <LoadingState label="Fetching real issues from GitHub..." /> :
        issues.length ? (
          <>
            <div className="issue-grid">
              {visibleIssues.map((issue) => <IssueCard key={issue.id} issue={issue} profile={profile} showBreakdown={Boolean(profile)} />)}
            </div>
            <div className="pagination">
              <Button variant="secondary" disabled={page <= 1} onClick={() => setApplied((current) => ({ ...current, page: page - 1 }))}>Previous</Button>
              <span className="issue-meta" style={{ alignSelf: "center" }}>Page {page} of {pageCount}</span>
              <Button variant="secondary" disabled={page >= pageCount || page >= 50} onClick={() => setApplied((current) => ({ ...current, page: page + 1 }))}>Next</Button>
            </div>
          </>
        ) : error ? null : (
          <EmptyState title="No matching issues found" description="Try different keywords, remove a filter, or check back later. Search results always come directly from GitHub." />
        )}
    </>
  );
}
