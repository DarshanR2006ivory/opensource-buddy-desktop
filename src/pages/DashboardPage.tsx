import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CircleUserRound } from "lucide-react";
import { useAuth } from "../app/AuthContext";
import { IssueCard } from "../components/IssueCard";
import { EmptyState, LoadingState, Notice, PageTitle } from "../components/ui";
import { listSavedIssues, searchIssues } from "../lib/issues";
import { getProfile } from "../lib/profile";
import { rankIssues } from "../lib/matching";
import type { DeveloperProfile, GitHubIssue, SavedIssue } from "../types/domain";

export function DashboardPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<DeveloperProfile | null>(null);
  const [issues, setIssues] = useState<GitHubIssue[]>([]);
  const [saved, setSaved] = useState<SavedIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    let active = true;
    void (async () => {
      try {
        const currentProfile = await getProfile(user);
        if (!active) return;
        setProfile(currentProfile);
        if (!currentProfile) return;
        const [results, savedIssues] = await Promise.all([
          searchIssues({
            language: currentProfile.languages[0],
            beginnerFriendly: currentProfile.experience_level === "beginner",
            sort: "match",
            perPage: 20,
          }),
          listSavedIssues(),
        ]);
        if (!active) return;
        setIssues(rankIssues(results.items, currentProfile).slice(0, 6));
        setSaved(savedIssues);
        if (results.cacheWarning) setError(results.cacheWarning);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load recommendations.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [user]);

  return (
    <>
      <PageTitle eyebrow="Your workspace" title="Welcome back" description="A focused shortlist based on your profile, with a transparent explanation for every match." action={<Link className="text-link" to="/explore">Explore all issues <ArrowRight size={14} /></Link>} />
      {loading ? <LoadingState label="Finding real GitHub issues for your profile..." /> : error && <Notice tone={error.includes("Supabase") || error.includes("rate limit") ? "error" : "info"}>{error}</Notice>}
      {!loading && !profile && (
        error
          ? <EmptyState title="Dashboard data unavailable" description="Your profile could not be loaded. Check your connection or explore public issues while you retry." action={{ label: "Explore issues", to: "/explore" }} />
          : <EmptyState title="Set up your developer profile" description="Add your languages, skills, interests, and experience level to get tailored issue recommendations." action={{ label: "Complete onboarding", to: "/onboarding" }} />
      )}
      {!loading && profile && (
        <div className="dashboard-grid">
          <section>
            <div className="panel-heading"><h2>Recommended for you</h2><Link to="/explore">See all</Link></div>
            {issues.length ? <div className="issue-grid">{issues.map((issue) => <IssueCard key={issue.id} issue={issue} profile={profile} showBreakdown />)}</div> : !error && <EmptyState title="No issues found for this profile yet" description="Try broadening your language or exploring all open issues." action={{ label: "Open issue explorer", to: "/explore" }} />}
          </section>
          <aside className="dashboard-side">
            <div className="stat-card"><span>Saved issues</span><strong>{saved.length}</strong><small>Ideas worth coming back to</small></div>
            <div className="stat-card"><span>In progress</span><strong>{saved.filter((item) => item.status === "in_progress").length}</strong><small>Your active contributions</small></div>
            <div className="panel">
              <div className="panel-heading"><h2>Your profile</h2><Link to="/profile">Edit</Link></div>
              <div className="profile-summary"><CircleUserRound size={16} aria-hidden="true" /><br /><strong>{profile.experience_level}</strong><br />{profile.languages.join(", ") || "Add programming languages"}<br />{profile.interests.slice(0, 3).join(", ")}</div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
