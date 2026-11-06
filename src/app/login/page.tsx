"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { CircleDollarSign, LoaderCircle, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const params = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const supabase = createClient();
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.assign(params.get("next") || "/");
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage(data.session ? "Account created. You can now sign in." : "Account created. Check your email to confirm your address.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="grid min-h-screen place-items-center px-5 py-10">
    <section className="w-full max-w-md">
      <div className="mb-8 flex items-center justify-center gap-3">
        <div className="grid size-12 place-items-center rounded-2xl bg-emerald-400 text-slate-950"><CircleDollarSign size={27}/></div>
        <div><div className="text-xl font-semibold">PanciLedger</div><div className="muted text-xs">by PanciWartegX</div></div>
      </div>
      <div className="panel p-7 sm:p-8">
        <div className="text-center"><h1 className="text-2xl font-semibold">{mode === "signin" ? "Welcome back" : "Create your account"}</h1><p className="muted mt-2 text-sm">Secure access to your financial workspaces.</p></div>
        <form onSubmit={submit} className="mt-7 space-y-4">
          <label className="block text-sm text-slate-300">Email address<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 outline-none focus:border-emerald-400" placeholder="you@example.com"/></label>
          <label className="block text-sm text-slate-300">Password<input required minLength={8} type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={e=>setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 outline-none focus:border-emerald-400" placeholder="At least 8 characters"/></label>
          {message && <p role="status" className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 text-sm text-emerald-200">{message}</p>}
          <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-60">{busy && <LoaderCircle className="animate-spin" size={17}/>} {mode === "signin" ? "Sign in" : "Create account"}</button>
        </form>
        <div className="muted mt-5 text-center text-sm">{mode === "signin" ? "New to PanciLedger?" : "Already have an account?"} <button onClick={()=>{setMode(mode === "signin" ? "signup" : "signin");setMessage("");}} className="font-medium text-emerald-300">{mode === "signin" ? "Create account" : "Sign in"}</button></div>
      </div>
      <p className="muted mt-5 flex items-center justify-center gap-2 text-xs"><ShieldCheck size={14}/> Protected by Supabase authentication</p>
      <p className="muted mt-8 text-center text-xs">© 2026 PanciWartegX. All rights reserved.</p>
    </section>
  </main>;
}