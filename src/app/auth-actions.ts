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
  const next = safeNext(data.get("next"));

  if (identifier.length < 3 || identifier.length > 254 || password.length < 8 || password.length > 256) {
    redirect("/login?error=invalid_credentials");
  }

  const supabase = await createClient();
  const { data: resolvedEmail, error: lookupError } = await supabase.rpc(
    "resolve_auth_email_for_login",
    { login_identifier: identifier, login_password: password }
  );

  if (lookupError || typeof resolvedEmail !== "string" || !resolvedEmail) {
    redirect("/login?error=invalid_credentials");
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: resolvedEmail,
    password,
  });

  if (error) redirect("/login?error=invalid_credentials");
  redirect(next);
}
