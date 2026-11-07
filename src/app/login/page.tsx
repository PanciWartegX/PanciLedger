"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CircleDollarSign, LoaderCircle, ShieldCheck } from "lucide-react";
import { Turnstile } from "@marsidev/react-turnstile";
import { createClient } from "@/lib/supabase/client";
import { createSignupClient } from "@/lib/supabase/signup";
import { signInWithUsernameAction } from "@/app/auth-actions";

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nextPath, setNextPath] = useState("/");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaWidgetKey, setCaptchaWidgetKey] = useState(0);
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
  const captchaReady = Boolean(turnstileSiteKey && captchaToken);

  function resetCaptcha() {
    setCaptchaToken("");
    setCaptchaWidgetKey((value) => value + 1);
  }

  const captchaWidget = turnstileSiteKey ? (
    <div className="overflow-hidden">
      <Turnstile
        key={captchaWidgetKey}
        siteKey={turnstileSiteKey}
        onSuccess={setCaptchaToken}
        onExpire={() => setCaptchaToken("")}
        onError={() => setCaptchaToken("")}
        options={{ theme: "dark" }}
      />
    </div>
  ) : (
    <p className="text-xs text-amber-300">CAPTCHA belum dikonfigurasi. Pendaftaran akan aktif setelah Site Key Cloudflare ditambahkan.</p>
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");
    if (next && next.startsWith("/") && !next.startsWith("//")) setNextPath(next);
    if (params.get("error") === "invalid_credentials") {
      setMessage("Username/email atau kata sandi tidak sesuai.");
    } else if (params.get("error") === "logout_failed") {
      setMessage("Logout belum berhasil. Silakan coba lagi.");
    } else if (params.get("error") === "auth_callback") {
      setMessage("Tautan pemulihan tidak valid atau sudah kedaluwarsa. Minta tautan baru.");
    } else if (params.get("password_updated") === "1") {
      setMessage("Kata sandi berhasil diperbarui. Silakan masuk kembali.");
    } else if (params.get("logged_out") === "1") {
      setMessage("Kamu berhasil keluar dari PanciLedger.");
    }
  }, []);

  async function requestPasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        throw new Error("Masukkan alamat email yang valid.");
      }
      if (turnstileSiteKey && !captchaToken) throw new Error("Selesaikan CAPTCHA terlebih dahulu.");
      const supabase = createClient();
      const callback = new URL("/auth/callback", window.location.origin);
      callback.searchParams.set("next", "/reset-password");
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: callback.toString(),
        ...(captchaToken ? { captchaToken } : {}),
      });
      if (error) throw new Error("Permintaan belum dapat diproses. Periksa email dan coba lagi.");
      setMessage("Jika email terdaftar, tautan pemulihan akan dikirim. Periksa kotak masuk dan folder spam.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Permintaan pemulihan gagal.");
    } finally {
      setBusy(false);
      resetCaptcha();
    }
  }

  async function signup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const normalizedUsername = username.trim().toLowerCase();
      if (!/^[a-z0-9_]{3,24}$/.test(normalizedUsername)) {
        throw new Error("Username harus 3–24 karakter, hanya huruf kecil, angka, dan garis bawah.");
      }
      if (displayName.trim().length < 2 || displayName.trim().length > 80) {
        throw new Error("Nama lengkap harus 2–80 karakter.");
      }
      if (!turnstileSiteKey || !captchaToken) throw new Error("CAPTCHA belum siap. Selesaikan verifikasi terlebih dahulu.");
      const signupClient = createSignupClient();
      const { data, error } = await signupClient.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          captchaToken,
          data: { username: normalizedUsername, display_name: displayName.trim() },
        },
      });
      if (error) {
        if (/already registered|already exists/i.test(error.message)) {
          throw new Error("Email sudah terdaftar. Silakan masuk.");
        }
        if (/username/i.test(error.message)) {
          throw new Error("Username sudah digunakan atau formatnya tidak valid.");
        }
        throw new Error("Pendaftaran gagal. Periksa data dan coba lagi.");
      }
      if (data.session) {
        const sessionClient = createClient();
        const { error: sessionError } = await sessionClient.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
        if (sessionError) throw new Error("Akun dibuat, tetapi sesi belum dapat dimulai. Silakan masuk.");
        window.location.assign(nextPath);
        return;
      }
      setMessage("Akun dibuat. Jika akun belum langsung aktif, pengaturan konfirmasi email Supabase masih perlu dimatikan.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Pendaftaran gagal. Silakan coba lagi.");
    } finally {
      setBusy(false);
      resetCaptcha();
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
          <div className="text-center">
            <h1 className="text-2xl font-semibold">{mode === "signin" ? "Selamat datang kembali" : mode === "signup" ? "Buat akun PanciLedger" : "Pulihkan kata sandi"}</h1>
            <p className="muted mt-2 text-sm">{mode === "signin" ? "Masuk menggunakan username atau email dan kata sandi." : mode === "signup" ? "Daftar tanpa verifikasi email. Gunakan email yang benar agar pemulihan akun dapat dilakukan." : "Masukkan email akun untuk menerima tautan pemulihan."}</p>
          </div>
          {mode === "signin" ? (
            <form action={signInWithUsernameAction} className="mt-7 space-y-4">
              <label className="block text-sm text-slate-300">Username atau email
                <input required name="identifier" autoComplete="username" className="field mt-2" placeholder="username atau email"/>
              </label>
              <label className="block text-sm text-slate-300">Kata sandi
                <input required name="password" minLength={8} maxLength={256} type="password" autoComplete="current-password" className="field mt-2" placeholder="Kata sandi"/>
              </label>
              <div className="text-right"><button type="button" onClick={() => { setMode("reset"); setMessage(""); resetCaptcha(); }} className="text-xs text-emerald-300 underline">Lupa kata sandi?</button></div>
              <input type="hidden" name="next" value={nextPath}/>
              <input type="hidden" name="captchaToken" value={captchaToken}/>
              {captchaWidget}
              {message && <p role="status" className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 text-sm text-emerald-200">{message}</p>}
              <button type="submit" disabled={Boolean(turnstileSiteKey && !captchaReady)} className="primary w-full disabled:opacity-60">Masuk</button>
            </form>
          ) : mode === "signup" ? (
            <form onSubmit={signup} className="mt-7 space-y-4">
              <label className="block text-sm text-slate-300">Nama lengkap
                <input required minLength={2} maxLength={80} autoComplete="name" value={displayName} onChange={event => setDisplayName(event.target.value)} className="field mt-2" placeholder="Nama yang akan ditampilkan"/>
              </label>
              <label className="block text-sm text-slate-300">Username
                <input required minLength={3} maxLength={24} autoComplete="username" value={username} onChange={event => setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} className="field mt-2" placeholder="contoh: renanda_01"/>
                <span className="muted mt-1 block text-xs">3–24 karakter: huruf kecil, angka, garis bawah.</span>
              </label>
              <label className="block text-sm text-slate-300">Email akun (untuk pemulihan kata sandi)
                <input required type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} className="field mt-2" placeholder="you@example.com"/>
              </label>
              <label className="block text-sm text-slate-300">Kata sandi
                <input required minLength={8} maxLength={256} type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} className="field mt-2" placeholder="Minimal 8 karakter"/>
              </label>
              {captchaWidget}
              <input type="hidden" name="captchaToken" value={captchaToken}/>
              {message && <p role="status" className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 text-sm text-emerald-200">{message}</p>}
              <button type="submit" disabled={busy || !captchaReady} className="primary flex w-full items-center justify-center gap-2 disabled:opacity-60">{busy && <LoaderCircle className="animate-spin" size={17}/>} Daftar akun</button>
            </form>
          ) : (
            <form onSubmit={requestPasswordReset} className="mt-7 space-y-4">
              <label className="block text-sm text-slate-300">Email akun
                <input required type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} className="field mt-2" placeholder="you@example.com"/>
              </label>
              {captchaWidget}
              {message && <p role="status" className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 text-sm text-emerald-200">{message}</p>}
              <button type="submit" disabled={busy || Boolean(turnstileSiteKey && !captchaReady)} className="primary flex w-full items-center justify-center gap-2 disabled:opacity-60">{busy && <LoaderCircle className="animate-spin" size={17}/>} Kirim tautan pemulihan</button>
            </form>
          )}
          <div className="muted mt-5 text-center text-sm">{mode === "signin" ? "Belum punya akun?" : mode === "signup" ? "Sudah punya akun?" : "Ingat kata sandi?"} <button type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(""); resetCaptcha(); }} className="font-medium text-emerald-300">{mode === "signin" ? "Daftar akun" : "Masuk"}</button></div>
        </div>
        <p className="muted mt-5 flex items-center justify-center gap-2 text-xs"><ShieldCheck size={14}/> Dilindungi oleh autentikasi Supabase dan Cloudflare Turnstile</p>
        <p className="muted mt-8 text-center text-xs">© 2026 PanciWartegX. Hak cipta dilindungi.</p>
      </section>
    </main>
  );
}
