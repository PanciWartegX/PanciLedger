import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const invalidCredentials = () =>
  new Response(JSON.stringify({ error: "Username/email atau kata sandi tidak sesuai." }), {
    status: 401,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await request.json();
    const identifier = typeof body.identifier === "string" ? body.identifier.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const captchaToken = typeof body.captchaToken === "string" ? body.captchaToken : "";
    if (identifier.length < 3 || identifier.length > 254 || password.length < 8 || password.length > 256) {
      return invalidCredentials();
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return new Response(JSON.stringify({ error: "Authentication service is not configured." }), {
        status: 503,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let email = identifier;
    if (!identifier.includes("@")) {
      const { data: profile, error: profileError } = await admin
        .from("profiles")
        .select("id")
        .eq("username", identifier.toLowerCase())
        .maybeSingle();

      if (profileError || !profile) return invalidCredentials();

      const { data: userData, error: userError } = await admin.auth.admin.getUserById(profile.id);
      if (userError || !userData.user?.email) return invalidCredentials();
      email = userData.user.email;
    }

    const { data, error } = await authClient.auth.signInWithPassword({
      email,
      password,
      ...(captchaToken ? { options: { captchaToken } } : {}),
    });
    if (error || !data.session) return invalidCredentials();

    return new Response(JSON.stringify({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch {
    return invalidCredentials();
  }
});
