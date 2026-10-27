import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Check, Copy, ExternalLink, Sparkles } from "lucide-react";
import { Button, EmptyState, LoadingState, Notice, PageTitle } from "../components/ui";
import { generateContributionGuide, getIssue } from "../lib/issues";
import type { ContributionGuide, GitHubIssue } from "../types/domain";

export function MentorPage() {
  const { owner = "", repo = "", number = "" } = useParams();
  const [searchParams] = useSearchParams();
  const generateOnLoad = searchParams.get("generate") === "1";
  const [issue, setIssue] = useState<GitHubIssue | null>(null);
  const [guide, setGuide] = useState<ContributionGuide | null>(null);
  const [loadingIssue, setLoadingIssue] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  useEffect(() => {
    let active = true;
    async function loadIssue() {
      setLoadingIssue(true);
      setIssue(null);
      setGuide(null);
      setError("");
      try {
        const data = await getIssue(decodeURIComponent(owner), decodeURIComponent(repo), Number(number));
        if (!active) return;
        setIssue(data);
        setLoadingIssue(false);
        if (generateOnLoad) {
          setGenerating(true);
          try {
            const generatedGuide = await generateContributionGuide(data);
            if (active) setGuide(generatedGuide);
          } catch (reason) {
            if (active) setError(reason instanceof Error ? reason.message : "Could not generate contribution guidance.");
          } finally {
            if (active) setGenerating(false);
          }
        }
      } catch (reason) {
        if (active) {
          setError(reason instanceof Error ? reason.message : "Could not load the source issue.");
          setLoadingIssue(false);
        }
      }
    }
    void loadIssue();
    return () => { active = false; };
  }, [owner, repo, number, generateOnLoad]);

  async function loadIssueAgain() {
    setLoadingIssue(true);
    setError("");
    try {
      const data = await getIssue(decodeURIComponent(owner), decodeURIComponent(repo), Number(number));
      setIssue(data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load the source issue.");
    } finally {
      setLoadingIssue(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    setError("");
    setCopyState("idle");
    try {
      if (!issue) throw new Error("Load a real GitHub issue before generating a guide.");
      setGuide(await generateContributionGuide(issue));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not generate contribution guidance.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopyGuide() {
    if (!guide) return;
    setCopyState("idle");
    const sections: Array<[string, string | string[] | undefined]> = [
      ["Issue summary", guide.issue_explanation ?? guide.summary],
      ["Expected outcome", guide.expected_outcome],
      ["Suggested solution", guide.solution_approach],
      ["Prerequisites", guide.prerequisites],
      ["Repository setup", guide.repository_setup_workflow ?? guide.setup],
      ["Possible causes", guide.possible_root_causes],
      ["Files to inspect", guide.files_to_inspect ?? guide.files_to_investigate],
      ["Implementation plan", guide.implementation_steps ?? guide.steps],
      ["Example code", guide.example_code],
      ["Testing steps", guide.test_commands ?? guide.testing],
      ["Edge cases", guide.edge_cases],
      ["Pull-request checklist", guide.pull_request_checklist ?? guide.pull_request],
    ];
    const text = sections
      .filter(([, content]) => content !== undefined && content !== "")
      .map(([title, content]) => `## ${title}\n${Array.isArray(content) ? content.map((item) => `- ${item}`).join("\n") : content}`)
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
    } catch {
      setCopyState("error");
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
      <div className="mentor-banner"><Sparkles size={18} /><span>Guidance is based on the selected GitHub issue. Verify every suggestion against the repository’s current instructions and issue discussion.</span></div>
      {error && <Notice tone="error">{error}</Notice>}
      {error && guide && !generating && <p><Button variant="secondary" onClick={handleGenerate}>Retry guide generation</Button></p>}
      {!guide && (
        <div className="panel">
          <p className="form-intro">The guide uses the selected issue details. Suggested causes, file paths, and commands are not verified against repository files.</p>
          <p className="issue-meta"><a className="icon-link" href={issue.html_url} target="_blank" rel="noreferrer">Review the original issue <ExternalLink size={13} /></a></p>
          <Button onClick={handleGenerate} disabled={generating} aria-busy={generating}><Sparkles size={15} /> {generating ? "Generating contribution guide..." : error ? "Retry guide generation" : "Generate contribution guide"}</Button>
        </div>
      )}
      {generating && <LoadingState label="Generating an issue-based contribution guide..." />}
      {guide && (
        <>
          <div className="inline-actions mentor-guide-actions">
            <Button variant="secondary" onClick={handleCopyGuide}><Copy size={14} /> Copy guide</Button>
            <Button variant="quiet" onClick={handleGenerate} disabled={generating}><Sparkles size={14} /> Generate again</Button>
          </div>
          {copyState === "copied" && <Notice tone="success"><Check size={14} /> Guide copied to clipboard.</Notice>}
          {copyState === "error" && <Notice tone="error">Could not copy the guide. Check clipboard permissions and try again.</Notice>}
          <Notice tone="info">
            {guide.generated_by === "ai"
              ? <><strong>AI-generated guidance, not verified against repository code.</strong> Suggested causes, file paths, and commands need to be checked against the repository. No code was changed or tested.</>
              : <><strong>Starter guide (AI not configured).</strong> This guide uses a non-AI fallback and avoids guessing project-specific commands or file paths.</>}
          </Notice>
          <section className="guide-section"><h2>Issue explanation</h2><p>{guide.issue_explanation ?? guide.summary}</p></section>
          {guide.expected_outcome && <section className="guide-section"><h2>Expected outcome</h2><p>{guide.expected_outcome}</p></section>}
          {guide.solution_approach && <section className="guide-section"><h2>Suggested solution approach</h2><p>{guide.solution_approach}</p></section>}
          {guide.possible_root_causes && <section className="guide-section"><h2>Possible root causes <span className="mentor-qualification">unverified hypotheses</span></h2><ul>{guide.possible_root_causes.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul></section>}
          {guide.prerequisites.length > 0 && <section className="guide-section"><h2>Prerequisites</h2><ul>{guide.prerequisites.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul></section>}
          {guide.setup.length > 0 && <section className="guide-section"><h2>Repository setup workflow</h2><ol>{guide.setup.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ol></section>}
          <section className="guide-section"><h2>Implementation steps</h2><ol>{(guide.implementation_steps ?? guide.steps).map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ol></section>
          <section className="guide-section">
            <h2>Files or areas to inspect <span className="mentor-qualification">suggestions, not verified paths</span></h2>
            {(guide.files_to_inspect ?? guide.files_to_investigate).length
              ? <ul>{(guide.files_to_inspect ?? guide.files_to_investigate).map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>
              : <p>No specific file paths were suggested. Explore the repository structure and confirm the likely area with maintainers.</p>}
          </section>
          {guide.example_code && <section className="guide-section"><h2>Illustrative example code</h2><p>Example only; not applied to the repository.</p><pre className="mentor-code"><code>{guide.example_code}</code></pre></section>}
          <section className="guide-section"><h2>Suggested test commands <span className="mentor-qualification">not run</span></h2><ul>{(guide.test_commands ?? guide.testing).map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul></section>
          {guide.edge_cases && <section className="guide-section"><h2>Edge cases</h2><ul>{guide.edge_cases.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul></section>}
          <section className="guide-section"><h2>Pull request checklist</h2><ul>{(guide.pull_request_checklist ?? guide.pull_request).map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul></section>
          {guide.context_note && <section className="guide-section"><h2>What has not been verified</h2><p>{guide.context_note}</p></section>}
          {guide.verify.length > 0 && <section className="guide-section"><h2>Verify before contributing</h2><ul>{guide.verify.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul></section>}
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
