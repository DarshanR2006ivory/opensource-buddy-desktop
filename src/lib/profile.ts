import type { User } from "@supabase/supabase-js";
import type { DeveloperProfile, ExperienceLevel } from "../types/domain";
import { supabase } from "./supabase";

export type ProfileInput = Omit<DeveloperProfile, "id" | "updated_at">;

export async function getProfile(user: User): Promise<DeveloperProfile | null> {
  if (!supabase) throw new Error("Connect Supabase to load your profile.");
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new Error(`Could not load profile: ${error.message}`);
  return data
    ? {
        id: data.id,
        languages: data.languages ?? [],
        skills: data.skills ?? [],
        experience_level: data.experience_level as ExperienceLevel,
        interests: data.interests ?? [],
        project_types: data.project_types ?? [],
        github_username: data.github_username,
        updated_at: data.updated_at,
      }
    : null;
}

export async function saveProfile(user: User, profile: ProfileInput): Promise<void> {
  if (!supabase) throw new Error("Connect Supabase to save your profile.");
  if (profile.experience_level !== "beginner" &&
      profile.experience_level !== "intermediate" &&
      profile.experience_level !== "advanced") {
    throw new Error("Choose a valid experience level before saving your profile.");
  }
  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    ...profile,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Could not save profile: ${error.message}`);
}
