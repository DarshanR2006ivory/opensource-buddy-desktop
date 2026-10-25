import { ArrowRight, BookOpenCheck, Compass, ShieldCheck, Sparkles, Target } from "lucide-react";
import { useAuth } from "../app/AuthContext";
import { Button } from "../components/ui";

export function LandingPage() {
  const { user, configured } = useAuth();
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Your open-source starting point</p>
          <h1>Find an issue.<br /><span>Make it yours.</span></h1>
          <p>
            OpenSource Buddy finds real GitHub issues that fit what you know and what you want
            to learn—so your next contribution feels like a clear next step.
          </p>
          <div className="hero-actions">
            <Button to={user ? "/dashboard" : configured ? "/auth" : "/explore"}>
              {user ? "Go to dashboard" : configured ? "Build my profile" : "Explore issues"}
              <ArrowRight size={15} aria-hidden="true" />
            </Button>
            <Button to="/explore" variant="secondary">Browse open issues</Button>
          </div>
          <div className="hero-proof"><span className="dot" /> Real public issues from the GitHub REST API</div>
        </div>
        <div>
          <div className="hero-visual" aria-label="Illustrative preview of an issue match">
            <div className="visual-top"><span>ILLUSTRATIVE MATCH PREVIEW</span><span>NOT LIVE DATA</span></div>
            <p className="visual-repo">owner / project-name</p>
            <h2 className="visual-title">A clear next step, matched to your interests</h2>
            <div className="visual-match"><span>Example match breakdown</span><strong>82%</strong></div>
            <div className="progress-track"><span /></div>
            <div className="visual-labels"><span>good first issue</span><span>skill overlap</span><span>clear description</span></div>
            <div className="hero-note"><ShieldCheck size={16} /> Scores are estimates, never guarantees.</div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <p className="eyebrow">A more approachable way in</p>
          <h2>From “where do I start?” to a real contribution.</h2>
          <p>Use your skills as a starting point, not a gate. Explore real projects and decide for yourself what feels right.</p>
        </div>
        <div className="feature-grid">
          <article className="feature-card">
            <span className="feature-icon"><Target size={18} /></span>
            <h3>Matches you can understand</h3>
            <p>See why an issue ranked well: skills, experience signals, clarity, and freshness are shown separately.</p>
          </article>
          <article className="feature-card">
            <span className="feature-icon"><Compass size={18} /></span>
            <h3>Real projects, real issues</h3>
            <p>Search the official GitHub REST API. Results are not demo cards or generated issue descriptions.</p>
          </article>
          <article className="feature-card">
            <span className="feature-icon"><BookOpenCheck size={18} /></span>
            <h3>Guidance when you need it</h3>
            <p>An optional AI mentor can turn an issue and repository guidance into a checklist to verify before contributing.</p>
          </article>
        </div>
      </section>
      <section className="section">
        <div className="panel" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
          <div><p className="eyebrow">Start at your own pace</p><h2 style={{ margin: 0, fontSize: 22 }}>Your next contribution can start here.</h2></div>
          <Button to="/explore">Explore open issues <Sparkles size={15} /></Button>
        </div>
      </section>
    </>
  );
}
