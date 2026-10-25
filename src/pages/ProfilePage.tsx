import { useEffect, useState } from "react";
import { useAuth } from "../app/AuthContext";
import { ProfileForm } from "../components/ProfileForm";
import { LoadingState, Notice, PageTitle } from "../components/ui";
import { getProfile, saveProfile } from "../lib/profile";
import type { DeveloperProfile } from "../types/domain";

export function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<DeveloperProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    let active = true;
    void getProfile(user)
      .then((data) => { if (active) setProfile(data); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Could not load your profile."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user]);

  return (
    <>
      <PageTitle eyebrow="Account settings" title="Your profile" description="Update the skills and interests used to personalize issue recommendations." />
      {error && <Notice tone="error">{error}</Notice>}
      {loading ? <LoadingState label="Loading your profile..." /> : (
        <ProfileForm
          key={profile?.updated_at ?? "new"}
          initial={profile}
          onSave={async (input) => {
            if (!user) throw new Error("Sign in to update your profile.");
            await saveProfile(user, input);
            const updated = await getProfile(user);
            setProfile(updated);
          }}
        />
      )}
    </>
  );
}
