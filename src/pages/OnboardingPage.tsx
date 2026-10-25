import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../app/AuthContext";
import { ProfileForm } from "../components/ProfileForm";
import { LoadingState, PageTitle } from "../components/ui";
import { getProfile, saveProfile } from "../lib/profile";
import type { DeveloperProfile } from "../types/domain";

export function OnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<DeveloperProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    void getProfile(user)
      .then(setProfile)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not load profile."))
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <>
      <PageTitle eyebrow="Personalize your discovery" title="A little about you" description="Tell us what you enjoy working with. You can change this any time." />
      {loading ? <LoadingState label="Loading your profile..." /> : error ? <p className="error-message" role="alert">{error}</p> : (
        <ProfileForm
          key={profile?.updated_at ?? "new"}
          initial={profile}
          submitLabel="Save and see recommendations"
          onSave={async (input) => {
            if (!user) throw new Error("Sign in to save your profile.");
            await saveProfile(user, input);
            navigate("/dashboard");
          }}
        />
      )}
    </>
  );
}
