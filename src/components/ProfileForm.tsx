import { useState, type FormEvent } from "react";
import type { DeveloperProfile, ExperienceLevel } from "../types/domain";
import type { ProfileInput } from "../lib/profile";
import { Button, Notice } from "./ui";

function splitList(value: string): string[] {
  return [...new Set(value.split(",").map((item) => item.trim().slice(0, 80)).filter(Boolean))].slice(0, 30);
}

export function ProfileForm({
  initial,
  onSave,
  submitLabel = "Save profile",
}: {
  initial?: DeveloperProfile | null;
  onSave: (profile: ProfileInput) => Promise<void>;
  submitLabel?: string;
}) {
  const [languages, setLanguages] = useState((initial?.languages ?? []).join(", "));
  const [skills, setSkills] = useState((initial?.skills ?? []).join(", "));
  const [experience, setExperience] = useState<ExperienceLevel>(initial?.experience_level ?? "beginner");
  const [interests, setInterests] = useState((initial?.interests ?? []).join(", "));
  const [projectTypes, setProjectTypes] = useState((initial?.project_types ?? []).join(", "));
  const [github, setGithub] = useState(initial?.github_username ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const languageList = splitList(languages);
    const githubName = github.trim();
    if (languageList.some((language) => language.length > 32)) {
      setError("Each programming language must be 32 characters or fewer.");
      return;
    }
    if (githubName && !/^[A-Za-z0-9-]{1,39}$/.test(githubName)) {
      setError("Enter a valid GitHub username, or leave the field blank.");
      return;
    }
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      await onSave({
        languages: languageList,
        skills: splitList(skills),
        experience_level: experience,
        interests: splitList(interests),
        project_types: splitList(projectTypes),
        github_username: githubName || null,
      });
      setSaved(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save your profile.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form-card wide" onSubmit={handleSubmit}>
      <h2>Your developer profile</h2>
      <p className="form-intro">Add terms separated by commas. Your profile is private and only used to tailor recommendations.</p>
      {error && <Notice tone="error">{error}</Notice>}
      {saved && <Notice tone="success">Your profile has been saved.</Notice>}
      <div className="form-grid">
        <div className="field">
          <label htmlFor="languages">Programming languages</label>
          <input id="languages" value={languages} onChange={(event) => setLanguages(event.target.value)} placeholder="TypeScript, Python, Go" />
        </div>
        <div className="field">
          <label htmlFor="skills">Skills and tools</label>
          <input id="skills" value={skills} onChange={(event) => setSkills(event.target.value)} placeholder="React, testing, documentation" />
        </div>
        <div className="field">
          <label htmlFor="experience">Experience level</label>
          <select id="experience" value={experience} onChange={(event) => setExperience(event.target.value as ExperienceLevel)}>
            <option value="beginner">Beginner — building confidence</option>
            <option value="intermediate">Intermediate — comfortable contributing</option>
            <option value="advanced">Advanced — looking for deeper challenges</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="interests">Topics and interests</label>
          <input id="interests" value={interests} onChange={(event) => setInterests(event.target.value)} placeholder="Accessibility, developer tools, climate" />
        </div>
        <div className="field">
          <label htmlFor="project-types">Preferred project types</label>
          <input id="project-types" value={projectTypes} onChange={(event) => setProjectTypes(event.target.value)} placeholder="Web apps, libraries, education" />
        </div>
        <div className="field">
          <label htmlFor="github-username">GitHub username (optional)</label>
          <input id="github-username" value={github} onChange={(event) => setGithub(event.target.value)} placeholder="octocat" autoComplete="off" maxLength={39} />
        </div>
      </div>
      <div className="form-actions"><Button type="submit" disabled={busy}>{busy ? "Saving..." : submitLabel}</Button></div>
    </form>
  );
}
