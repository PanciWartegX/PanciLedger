import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = request.nextUrl.searchParams.get("next");
  const candidate = next ? new URL(next, request.url) : new URL("/", request.url);
  const safeNext = candidate.origin === request.nextUrl.origin ? candidate : new URL("/", request.url);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(safeNext);
  }
  return NextResponse.redirect(new URL("/login?error=auth_callback", request.url));
}
