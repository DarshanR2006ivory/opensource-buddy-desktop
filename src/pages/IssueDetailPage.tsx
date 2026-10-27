import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Bookmark, ExternalLink, Sparkles } from "lucide-react";
import { useAuth } from "../app/AuthContext";
import { Button, EmptyState, LoadingState, Notice } from "../components/ui";
import { getIssue, saveIssue } from "../lib/issues";
import type { GitHubIssue } from "../types/domain";

export function IssueDetailPage() {
  const { owner = "", repo = "", number = "" } = useParams();
  const { user } = useAuth();
  const [issue, setIssue] = useState<GitHubIssue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    const parsedNumber = Number(number);
    if (!Number.isSafeInteger(parsedNumber) || parsedNumber < 1) {
      setError("This issue number is invalid.");
      setLoading(false);
      return;
    }
    void getIssue(decodeURIComponent(owner), decodeURIComponent(repo), parsedNumber)
      .then((data) => { if (active) setIssue(data); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Could not load this GitHub issue."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [owner, repo, number]);

  async function handleSave() {
    if (!issue) return;
    setSaving(true);
    setMessage("");
    try {
      await saveIssue(issue);
      setMessage("Issue saved to your list.");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Could not save this issue.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState label="Loading the original GitHub issue..." />;
  if (error && !issue) return <><Notice tone="error">{error}</Notice><EmptyState title="Issue details unavailable" description="The issue may have been removed, GitHub may be rate-limiting requests, or the Supabase issue service may not be configured." /></>;
  if (!issue) return null;

  return (
    <div className="detail-layout">
      <article className="panel detail-panel">
        <p className="eyebrow">GitHub issue #{issue.number}</p>
        <p className="detail-repo">
          <a className="icon-link" href={`https://github.com/${encodeURIComponent(issue.owner)}/${encodeURIComponent(issue.repository)}`} target="_blank" rel="noreferrer">
            {issue.repository_full_name} <ExternalLink size={13} aria-hidden="true" />
          </a>
          {" · "}{issue.state}
        </p>
        <h1 className="detail-heading">{issue.title}</h1>
        <div className="label-row">{issue.labels.map((label) => <span className="label-chip" key={label.name}>{label.name}</span>)}{issue.language && <span className="language-chip">{issue.language}</span>}</div>
        <div className="detail-body">{issue.body || "The issue author did not provide a description."}</div>
      </article>
      <aside className="detail-aside">
        <h3>Issue actions</h3>
        <a className="button button-secondary" href={issue.html_url} target="_blank" rel="noreferrer">Open original issue <ExternalLink size={14} /></a>
        {user ? (
          <>
            <Button variant="secondary" onClick={handleSave} disabled={saving}><Bookmark size={14} /> {saving ? "Saving..." : "Save issue"}</Button>
          </>
        ) : <p>Sign in to save this issue or track your progress. AI guidance requires an account.</p>}
        <Button to={`/mentor/${encodeURIComponent(issue.owner)}/${encodeURIComponent(issue.repository)}/${issue.number}?generate=1`}><Sparkles size={14} /> Ask AI Mentor</Button>
        {message && <p className={message.includes("saved") ? "success-message" : "error-message"} role="status">{message}</p>}
        <p>Open-source issue matching is an estimate. Review the discussion, repository activity, and maintainer instructions before starting work.</p>
      </aside>
    </div>
  );
}
