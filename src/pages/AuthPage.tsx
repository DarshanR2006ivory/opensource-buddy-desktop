import { useState, type FormEvent } from "react";
import { Github } from "lucide-react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../app/AuthContext";
import { Button, Notice } from "../components/ui";

export function AuthPage() {
  const { user, configured, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  if (user) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      if (mode === "signin") {
        await signIn(email.trim(), password);
        navigate("/dashboard");
      } else {
        const hasSession = await signUp(email.trim(), password);
        if (hasSession) navigate("/onboarding");
        else setMessage("Check your inbox to confirm your email, then sign in to continue.");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="form-card">
        <span className="auth-mark"><Github size={22} /></span>
        <p className="eyebrow">{mode === "signup" ? "Create your account" : "Welcome back"}</p>
        <h2>{mode === "signup" ? "Make room for your next contribution." : "Pick up where you left off."}</h2>
        <p className="form-intro">Use your account to save issues, track progress, and personalize recommendations.</p>
        {!configured && (
          <Notice tone="error">Authentication is unavailable until Supabase is configured. See the setup steps in README.</Notice>
        )}
        {error && <Notice tone="error">{error}</Notice>}
        {message && <Notice tone="success">{message}</Notice>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">Email address</label>
            <input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} />
            {mode === "signup" && <span className="field-hint">Use at least 8 characters.</span>}
          </div>
          <Button type="submit" disabled={!configured || busy} className="full-width">
            {busy ? "Please wait..." : mode === "signup" ? "Create account" : "Sign in"}
          </Button>
        </form>
        <p className="auth-switch">
          {mode === "signup" ? "Already have an account?" : "New to OpenSource Buddy?"}
          <button type="button" onClick={() => { setError(""); setMessage(""); setMode(mode === "signup" ? "signin" : "signup"); }}>
            {mode === "signup" ? "Sign in" : "Create an account"}
          </button>
        </p>
        <p className="auth-switch"><Link className="text-link" to="/explore">Browse issues without an account</Link></p>
      </div>
    </div>
  );
}
