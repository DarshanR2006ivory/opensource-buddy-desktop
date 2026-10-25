import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? "";

function validateSupabaseUrl(value: string): string | null {
  if (!value) return "VITE_SUPABASE_URL is missing.";
  try {
    const url = new URL(value);
    const localHttp = url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
    if (url.protocol !== "https:" && !localHttp) {
      return "VITE_SUPABASE_URL must use HTTPS (HTTP is allowed for localhost development).";
    }
  } catch {
    return "VITE_SUPABASE_URL must be a valid Supabase project URL.";
  }
  return null;
}

const missingValues = [
  validateSupabaseUrl(supabaseUrl),
  !supabaseAnonKey ? "VITE_SUPABASE_ANON_KEY is missing." : null,
].filter((message): message is string => message !== null);

export const supabaseSetupError = missingValues.length
  ? `Supabase is not ready. ${missingValues.join(" ")} Copy .env.example to .env, fill in the public Supabase project URL and anon/publishable key, then restart Vite.`
  : null;

export const isSupabaseConfigured = supabaseSetupError === null;

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;
