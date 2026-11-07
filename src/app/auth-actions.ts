"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const safeNext = (value: FormDataEntryValue | null) => {
  const target = typeof value === "string" ? value.trim() : "";
  return target.startsWith("/") && !target.startsWith("//") && !target.includes("\\")
    ? target
    : "/";
};

export async function signInWithUsernameAction(data: FormData) {
  const identifier = String(data.get("identifier") ?? "").trim();
  const password = String(data.get("password") ?? "");
  const captchaToken = String(data.get("captchaToken") ?? "");
  const next = safeNext(data.get("next"));

  if (identifier.length < 3 || identifier.length > 254 || password.length < 8 || password.length > 256 || (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !captchaToken)) {
    redirect("/login?error=invalid_credentials");
  }

  const supabase = await createClient();
  const { data: sessionData, error: loginError } = await supabase.functions.invoke("username-login", {
    body: { identifier, password, captchaToken: captchaToken || undefined },
  });

  if (loginError || !sessionData?.access_token || !sessionData?.refresh_token) {
    redirect("/login?error=invalid_credentials");
  }

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: sessionData.access_token,
    refresh_token: sessionData.refresh_token,
  });

  if (sessionError) redirect("/login?error=invalid_credentials");
  redirect(next);
}
