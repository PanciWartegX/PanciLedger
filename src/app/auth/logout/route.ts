import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const target = new URL("/login?logged_out=1", request.url);
  const response = NextResponse.redirect(target, 303);

  if (!url || !key) {
    return NextResponse.redirect(new URL("/login?error=logout_failed", request.url), 303);
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) {
    response.headers.set("Location", new URL("/login?error=logout_failed", request.url).toString());
  }

  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}
