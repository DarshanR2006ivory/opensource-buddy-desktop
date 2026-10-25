import { useState } from "react";
import { Navigate, NavLink, Outlet, Route, Routes, useNavigate } from "react-router-dom";
import { Github, Menu, X } from "lucide-react";
import { useAuth } from "./AuthContext";
import { Button, ConfigNotice, LoadingState, Notice } from "../components/ui";
import { LandingPage } from "../pages/LandingPage";
import { AuthPage } from "../pages/AuthPage";
import { OnboardingPage } from "../pages/OnboardingPage";
import { DashboardPage } from "../pages/DashboardPage";
import { ExplorerPage } from "../pages/ExplorerPage";
import { IssueDetailPage } from "../pages/IssueDetailPage";
import { MentorPage } from "../pages/MentorPage";
import { SavedPage } from "../pages/SavedPage";
import { ProfilePage } from "../pages/ProfilePage";

function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingState label="Restoring your session..." />;
  return user ? <Outlet /> : <Navigate to="/auth" replace />;
}

function AppLayout() {
  const { user, signOut, configured } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [navError, setNavError] = useState("");
  const navigate = useNavigate();

  async function handleSignOut() {
    setNavError("");
    try {
      await signOut();
      navigate("/");
    } catch (error) {
      setNavError(error instanceof Error ? error.message : "Could not sign out.");
    }
  }

  const links = user
    ? [
        ["Dashboard", "/dashboard"],
        ["Explore issues", "/explore"],
        ["Saved", "/saved"],
        ["Profile", "/profile"],
      ]
    : [["Explore issues", "/explore"]];

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <NavLink className="brand" to="/" aria-label="OpenSource Buddy home">
            <span className="brand-mark"><Github size={19} aria-hidden="true" /></span>
            <span>OpenSource <b>Buddy</b></span>
          </NavLink>
          <button
            className="mobile-menu-button"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <nav className={`main-nav ${menuOpen ? "nav-open" : ""}`} aria-label="Main navigation">
            {links.map(([label, to]) => (
              <NavLink key={to} to={to} onClick={() => setMenuOpen(false)}>
                {label}
              </NavLink>
            ))}
            {user ? (
              <button className="nav-auth" onClick={handleSignOut}>Sign out</button>
            ) : (
              <Button to="/auth" className="nav-cta">{configured ? "Sign in" : "Get started"}</Button>
            )}
          </nav>
        </div>
      </header>
      <main className="main-content">
        {!configured && <ConfigNotice />}
        {navError && <Notice tone="error">{navError}</Notice>}
        <Outlet />
      </main>
      <footer className="site-footer">
        <span>OpenSource Buddy</span>
        <span>Find an issue. Make your first contribution.</span>
        <a href="https://docs.github.com/en/rest" target="_blank" rel="noreferrer">Powered by GitHub REST API</a>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="auth" element={<AuthPage />} />
        <Route path="explore" element={<ExplorerPage />} />
        <Route path="issues/:owner/:repo/:number" element={<IssueDetailPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="onboarding" element={<OnboardingPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="mentor/:owner/:repo/:number" element={<MentorPage />} />
          <Route path="saved" element={<SavedPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
