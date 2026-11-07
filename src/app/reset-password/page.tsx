"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CircleDollarSign, LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (password.length < 8 || password.length > 256) {
      setMessage("Kata sandi harus terdiri dari 8–256 karakter.");
      return;
    }
    if (password !== confirm) {
      setMessage("Konfirmasi kata sandi belum sama.");
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        setMessage("Sesi pemulihan tidak valid atau sudah kedaluwarsa. Minta tautan baru.");
        return;
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setMessage("Kata sandi belum dapat diperbarui. Pastikan memenuhi kebijakan keamanan.");
        return;
      }
      const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
      if (signOutError) {
        setMessage("Kata sandi sudah diperbarui, tetapi sesi belum keluar. Keluar secara manual lalu masuk kembali.");
        return;
      }
      router.replace("/login?password_updated=1");
    } catch {
      setMessage("Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-5 py-10">
      <section className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-emerald-400 text-slate-950"><CircleDollarSign size={27}/></div>
          <div><div className="text-xl font-semibold">PanciLedger</div><div className="muted text-xs">by PanciWartegX</div></div>
        </div>
        <div className="panel p-7 sm:p-8">
          <h1 className="text-center text-2xl font-semibold">Atur kata sandi baru</h1>
          <p className="muted mt-2 text-center text-sm">Gunakan kata sandi baru yang kuat dan tidak dipakai pada akun lain.</p>
          <form onSubmit={updatePassword} className="mt-7 space-y-4">
            <label className="block text-sm text-slate-300">Kata sandi baru
              <input required minLength={8} maxLength={256} type="password" autoComplete="new-password" value={password} onChange={event=>setPassword(event.target.value)} className="field mt-2" />
            </label>
            <label className="block text-sm text-slate-300">Konfirmasi kata sandi baru
              <input required minLength={8} maxLength={256} type="password" autoComplete="new-password" value={confirm} onChange={event=>setConfirm(event.target.value)} aria-invalid={Boolean(confirm && password !== confirm)} className="field mt-2" />
            </label>
            {confirm && password !== confirm && <p role="alert" className="text-xs text-rose-300">Konfirmasi kata sandi belum sama.</p>}
            {message && <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/5 p-3 text-sm text-rose-200">{message}</p>}
            <button type="submit" disabled={busy} className="primary flex w-full items-center justify-center gap-2 disabled:opacity-60">{busy && <LoaderCircle className="animate-spin" size={17}/>} Simpan kata sandi baru</button>
          </form>
        </div>
      </section>
    </main>
  );
}
