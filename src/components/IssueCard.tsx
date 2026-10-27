import { useState } from "react";
import { Bookmark, ExternalLink, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import type { DeveloperProfile, GitHubIssue, IssueMatch } from "../types/domain";
import { getIssueMatch } from "../lib/matching";
import { saveIssue } from "../lib/issues";
import { useAuth } from "../app/AuthContext";
import { Button, Notice } from "./ui";

export function IssueCard({
  issue,
  profile,
  showBreakdown = false,
}: {
  issue: GitHubIssue;
  profile?: DeveloperProfile | null;
  showBreakdown?: boolean;
}) {
  const { user } = useAuth();
  const match: IssueMatch | null = profile ? getIssueMatch(issue, profile) : null;
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setMessage("");
    setSaving(true);
    try {
      await saveIssue(issue);
      setMessage("Issue saved to your list.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save this issue.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="issue-card">
      <div className="issue-card-top">
        <a className="repo-name" href={`https://github.com/${encodeURIComponent(issue.owner)}/${encodeURIComponent(issue.repository)}`} target="_blank" rel="noreferrer">
          {issue.repository_full_name}
        </a>
        {match && (
          <span className="match-pill" aria-label={`Match score ${match.score} out of 100`}>
            <Sparkles size={13} aria-hidden="true" /> {match.score}% match
          </span>
        )}
      </div>
      <Link className="issue-title-link" to={`/issues/${encodeURIComponent(issue.owner)}/${encodeURIComponent(issue.repository)}/${issue.number}`}>
        <h2>{issue.title}</h2>
      </Link>
      <p className="issue-excerpt">
        {(issue.body ?? "No description provided by the issue author.").slice(0, 220)}
        {(issue.body?.length ?? 0) > 220 ? "…" : ""}
      </p>
      <div className="label-row">
        {issue.labels.slice(0, 4).map((label) => (
          <span className="label-chip" key={`${issue.id}-${label.name}`}>
            {label.name}
          </span>
        ))}
        {issue.language && <span className="language-chip">{issue.language}</span>}
      </div>
      {showBreakdown && match && (
        <>
          <div className="match-components" aria-label="Match component scores">
            {match.factors.map((factor) => (
              <span key={factor.label} title={`${factor.label}: ${factor.score}/100`}>
                {factor.label === "Skill match"
                  ? "Skills"
                  : factor.label === "Experience and difficulty fit"
                    ? "Experience fit"
                    : factor.label === "Beginner-friendly labels"
                      ? "Labels"
                      : factor.label === "Issue description clarity"
                        ? "Clarity"
                        : "Freshness"}: {factor.score}
              </span>
            ))}
          </div>
          <details className="score-details">
            <summary>Why this matches you · scoring breakdown</summary>
          <p className="score-disclaimer">A match estimate is not a guarantee that an issue is suitable.</p>
          {match.factors.map((factor) => (
            <div className="score-factor" key={factor.label}>
              <div>
                <span>{factor.label}</span>
                <strong>{factor.score}/100 · {factor.points.toFixed(2)}/{factor.weight} points</strong>
              </div>
              <p>{factor.explanation}</p>
            </div>
          ))}
          </details>
        </>
      )}
      <div className="issue-card-footer">
        <span className="issue-meta">#{issue.number} · Updated {new Date(issue.updated_at).toLocaleDateString()}</span>
        <div className="inline-actions">
          {user && (
            <Button variant="quiet" onClick={handleSave} disabled={saving} aria-label={`Save ${issue.title}`}>
              <Bookmark size={15} aria-hidden="true" /> {saving ? "Saving" : "Save"}
            </Button>
          )}
          <Button
            variant="quiet"
            to={`/mentor/${encodeURIComponent(issue.owner)}/${encodeURIComponent(issue.repository)}/${issue.number}?generate=1`}
          >
            <Sparkles size={15} aria-hidden="true" /> Ask AI Mentor
          </Button>
          <a className="icon-link" href={issue.html_url} target="_blank" rel="noreferrer">
            GitHub <ExternalLink size={13} aria-hidden="true" />
          </a>
        </div>
      </div>
      {message && <Notice tone={message.includes("saved") ? "success" : "error"}>{message}</Notice>}
    </article>
  );
}
