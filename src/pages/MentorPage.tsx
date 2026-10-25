import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ExternalLink, Sparkles } from "lucide-react";
import { Button, EmptyState, LoadingState, Notice, PageTitle } from "../components/ui";
import { generateContributionGuide, getIssue } from "../lib/issues";
import type { ContributionGuide, GitHubIssue } from "../types/domain";

export function MentorPage() {
  const { owner = "", repo = "", number = "" } = useParams();
  const [issue, setIssue] = useState<GitHubIssue | null>(null);
  const [guide, setGuide] = useState<ContributionGuide | null>(null);
  const [loadingIssue, setLoadingIssue] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoadingIssue(true);
    setIssue(null);
    setGuide(null);
    setError("");
    void getIssue(decodeURIComponent(owner), decodeURIComponent(repo), Number(number))
      .then((data) => { if (active) setIssue(data); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Could not load the source issue."); })
      .finally(() => { if (active) setLoadingIssue(false); });
    return () => { active = false; };
  }, [owner, repo, number]);

  async function loadIssueAgain() {
    setLoadingIssue(true);
    setError("");
    setIssue(null);
    try {
      setIssue(await getIssue(decodeURIComponent(owner), decodeURIComponent(repo), Number(number)));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load the source issue.");
    } finally {
      setLoadingIssue(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    setError("");
    try {
      setGuide(await generateContributionGuide(decodeURIComponent(owner), decodeURIComponent(repo), Number(number)));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not generate contribution guidance.");
    } finally {
      setGenerating(false);
    }
  }

  if (loadingIssue) return <LoadingState label="Loading the source issue..." />;
  if (!issue) {
    return (
      <>
        <PageTitle eyebrow="Contribution mentor" title="Issue context unavailable" description="A guide can only be created from a real GitHub issue." />
        {error && <Notice tone="error">{error}</Notice>}
        <EmptyState title="Could not load this issue" description="Check the issue URL, your connection, and the GitHub/Supabase service configuration, then retry." />
        <Button onClick={loadIssueAgain} disabled={loadingIssue}>Retry loading issue</Button>
      </>
    );
  }

  return (
    <>
      <PageTitle eyebrow="Contribution mentor" title="A guide for your next step" description={`${issue.owner}/${issue.repository} · #${issue.number} · ${issue.title}`} />
      <div className="mentor-banner"><Sparkles size={18} /><span>Guidance is grounded in the live issue and repository documentation where available. Verify every step against the repository’s current instructions and issue discussion.</span></div>
      {error && <Notice tone="error">{error}</Notice>}
      {!guide && (
        <div className="panel">
          <p className="form-intro">The guide uses the live issue title and description, plus the repository README and contribution guidelines when available. If the server has no AI key configured, a useful non-AI starter guide is provided instead.</p>
          <p className="issue-meta"><a className="icon-link" href={issue.html_url} target="_blank" rel="noreferrer">Review the original issue <ExternalLink size={13} /></a></p>
          <Button onClick={handleGenerate} disabled={generating} aria-busy={generating}><Sparkles size={15} /> {generating ? "Preparing guide from repository context..." : "Generate contribution guide"}</Button>
          {error && <p><Button variant="secondary" onClick={handleGenerate} disabled={generating}>Retry guide generation</Button></p>}
        </div>
      )}
      {generating && <LoadingState label="Reading issue and repository guidance..." />}
      {guide && (
        <>
          <Notice tone="info">
            {guide.generated_by === "ai"
              ? <><strong>AI-generated guide.</strong> Repository files and issue discussion can change. Verify this advice before making changes or opening a pull request.</>
              : <><strong>Starter guide (AI not configured).</strong> This guide uses a non-AI fallback and avoids guessing project-specific commands or file paths.</>}
          </Notice>
          <section className="guide-section"><h2>Issue explanation</h2><p>{guide.summary}</p></section>
          <section className="guide-section"><h2>Prerequisites</h2><ul>{guide.prerequisites.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul></section>
          <section className="guide-section"><h2>Repository setup workflow</h2><ol>{guide.setup.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ol></section>
          <section className="guide-section"><h2>Implementation steps</h2><ol>{guide.steps.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ol></section>
          <section className="guide-section">
            <h2>Files or areas to investigate</h2>
            {guide.files_to_investigate.length
              ? <ul>{guide.files_to_investigate.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>
              : <p>The available issue and repository information does not support recommending specific files. Explore the repository structure and confirm the likely area with maintainers.</p>}
          </section>
          <section className="guide-section"><h2>Testing checklist</h2><ul>{guide.testing.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul></section>
          <section className="guide-section"><h2>How to submit a pull request</h2><ol>{guide.pull_request.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ol></section>
          <section className="guide-section"><h2>Verify before contributing</h2><ul>{guide.verify.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul></section>
          <section className="guide-section">
            <h2>Source links and context</h2>
            <ul className="mentor-source-links">
              <li><a href={guide.links.issue} target="_blank" rel="noreferrer">Original GitHub issue <ExternalLink size={13} /></a></li>
              <li><a href={guide.links.repository} target="_blank" rel="noreferrer">Repository <ExternalLink size={13} /></a></li>
              {guide.links.readme && <li><a href={guide.links.readme} target="_blank" rel="noreferrer">Repository README <ExternalLink size={13} /></a></li>}
              {guide.links.contributing && <li><a href={guide.links.contributing} target="_blank" rel="noreferrer">Contribution guidelines <ExternalLink size={13} /></a></li>}
            </ul>
            <ul>{guide.source_notes.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>
          </section>
        </>
      )}
    </>
  );
}
