import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createSignupClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase URL and publishable key are not configured.");
  }

  // Supabase PKCE signup does not support email autoconfirm. Use an isolated
  // implicit-flow client for signup, then copy the returned session into the
  // cookie-backed SSR client used by the rest of the application.
  return createSupabaseClient(url, key, {
    auth: {
      flowType: "implicit",
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
