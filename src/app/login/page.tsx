"use client";

import { useState, type FormEvent } from "react";
import { CircleDollarSign, LoaderCircle, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setKata sandi] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const supabase = createClient();
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithKata sandi({ email, password });
        if (error) throw new Error("Email atau kata sandi tidak sesuai. Periksa kembali lalu coba lagi.");
        const next = new URLSearchParams(window.location.search).get("next");
        const target = next ? new URL(next, window.location.origin) : new URL("/", window.location.origin);
        window.location.assign(target.origin === window.location.origin ? `${target.pathname}${target.search}${target.hash}` : "/");
      } else {
        const emailRedirectTo = new URL("/auth/callback?next=%2F", window.location.origin).toString();
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo },
        });
        if (error) throw new Error("Pendaftaran gagal. Periksa format email dan pastikan kata sandi minimal 8 karakter.");
        if (data.session) {
          window.location.assign("/");
          return;
        }
        setMessage("Akun berhasil dibuat. Periksa email untuk mengonfirmasi alamat emailmu.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Autentikasi gagal. Silakan coba lagi.");
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
        <div className="text-center"><h1 className="text-2xl font-semibold">{mode === "signin" ? "Selamat datang kembali" : "Buat akun PanciLedger"}</h1><p className="muted mt-2 text-sm">Akses aman ke ruang kerja keuanganmu.</p></div>
        <form onSubmit={submit} className="mt-7 space-y-4">
          <label className="block text-sm text-slate-300">Alamat email<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 outline-none focus:border-emerald-400" placeholder="you@example.com"/></label>
          <label className="block text-sm text-slate-300">Kata sandi<input required minLength={8} type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={e=>setKata sandi(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 outline-none focus:border-emerald-400" placeholder="Minimal 8 karakter"/></label>
          {message && <p role="status" className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 text-sm text-emerald-200">{message}</p>}
          <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-60">{busy && <LoaderCircle className="animate-spin" size={17}/>} {mode === "signin" ? "Masuk" : "Daftar akun"}</button>
        </form>
        <div className="muted mt-5 text-center text-sm">{mode === "signin" ? "Belum punya akun PanciLedger?" : "Sudah punya akun?"} <button onClick={()=>{setMode(mode === "signin" ? "signup" : "signin");setMessage("");}} className="font-medium text-emerald-300">{mode === "signin" ? "Daftar akun" : "Masuk"}</button></div>
      </div>
      <p className="muted mt-5 flex items-center justify-center gap-2 text-xs"><ShieldCheck size={14}/> Dilindungi oleh autentikasi Supabase</p>
      <p className="muted mt-8 text-center text-xs">© 2026 PanciWartegX. Hak cipta dilindungi.</p>
    </section>
  </main>;
}
