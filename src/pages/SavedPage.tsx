import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookmarkX } from "lucide-react";
import { Button, EmptyState, LoadingState, Notice, PageTitle } from "../components/ui";
import { listSavedIssues, removeSavedIssue, updateIssueProgress } from "../lib/issues";
import type { SavedIssue } from "../types/domain";

const progressLabels: Record<SavedIssue["status"], string> = {
  saved: "Saved",
  in_progress: "In progress",
  completed: "Completed",
};

export function SavedPage() {
  const [saved, setSaved] = useState<SavedIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setSaved(await listSavedIssues());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load saved issues.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function changeStatus(issueId: number, status: SavedIssue["status"]) {
    setError("");
    setMessage("");
    try {
      await updateIssueProgress(issueId, status);
      setSaved((items) => items.map((item) => item.issue.id === issueId ? { ...item, status, updatedAt: new Date().toISOString() } : item));
      setMessage("Contribution progress updated.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update issue progress.");
    }
  }

  async function removeIssue(issueId: number) {
    setError("");
    setMessage("");
    try {
      await removeSavedIssue(issueId);
      setSaved((items) => items.filter((item) => item.issue.id !== issueId));
      setMessage("Issue removed from your saved list.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not remove the saved issue.");
    }
  }

  return (
    <>
      <PageTitle eyebrow="Your contribution list" title="Saved issues" description="Keep promising issues close and mark where you are in the contribution process." action={<Button to="/explore" variant="secondary">Find more issues</Button>} />
      {error && <Notice tone="error">{error}</Notice>}
      {message && <Notice tone="success">{message}</Notice>}
      {loading ? <LoadingState label="Loading your saved issues..." /> : error ? (
        <EmptyState title="Saved issues unavailable" description="Your saved issue list could not be loaded. Your items have not been changed." action={{ label: "Explore issues", to: "/explore" }} />
      ) : saved.length === 0 ? (
        <EmptyState title="Nothing saved yet" description="Save an issue that interests you and it will show up here. Your list is private to your account." action={{ label: "Explore GitHub issues", to: "/explore" }} />
      ) : (
        <div className="panel">
          {saved.map(({ issue, status }) => (
            <article className="saved-row" key={issue.id}>
              <div>
                <span className="repo-name">
                  <a href={`https://github.com/${encodeURIComponent(issue.owner)}/${encodeURIComponent(issue.repository)}`} target="_blank" rel="noreferrer">
                    {issue.repository_full_name}
                  </a>
                  {" · "}{`#${issue.number}`}
                </span>
                <Link to={`/issues/${encodeURIComponent(issue.owner)}/${encodeURIComponent(issue.repository)}/${issue.number}`}><h3>{issue.title}</h3></Link>
                <p>{issue.body?.slice(0, 180) || "No issue description is available."}{(issue.body?.length ?? 0) > 180 ? "…" : ""}</p>
              </div>
              <aside>
                <div className="saved-actions">
                  <label className="field" style={{ width: "100%", margin: 0 }}>
                    <span className="field-hint">Contribution progress</span>
                    <select aria-label={`Progress for ${issue.title}`} value={status} onChange={(event) => void changeStatus(issue.id, event.target.value as SavedIssue["status"])}>
                      {Object.entries(progressLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <Button variant="quiet" onClick={() => void removeIssue(issue.id)} aria-label={`Remove ${issue.title} from saved issues`}>
                    <BookmarkX size={14} /> Remove
                  </Button>
                </div>
              </aside>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
