# PanciLedger

**PanciWartegX** — aplikasi pengelolaan keuangan untuk beberapa ruang kerja.

Antarmuka menggunakan Bahasa Indonesia dengan tema navy gelap dan aksen emerald. Domain utama: **https://panciledger.vercel.app**.

## Status pengembangan

PanciLedger aktif dikembangkan pada branch `main`. Fitur keuangan inti dan modul tambahan telah digabung melalui [PR #2](https://github.com/PanciWartegX/PanciLedger/pull/2).

### Akun pengguna dan akses workspace

- Pengguna mendaftar sendiri dari halaman website dengan nama tampilan, username unik, email, dan kata sandi.
- Email tetap digunakan sebagai identitas Auth dan pemulihan akun. Jika Confirm Email dimatikan di Supabase Auth, akun langsung aktif dan pengguna dapat masuk menggunakan username atau email beserta kata sandi.
- Kredensial dikelola Supabase Auth. PanciLedger tidak menyimpan kata sandi sendiri.
- Username dipetakan ke akun Auth melalui Edge Function `username-login`; service-role key hanya digunakan di sisi Edge Function dan tidak dikirim ke browser.
- Undangan workspace dikirim sebagai tautan yang terikat pada email. Penerima membuat akun sendiri, lalu menerima undangan.
- Profil menyimpan nama tampilan dan username. RLS membatasi profil yang dapat dilihat ke pengguna sendiri dan rekan satu workspace.
- Menu antarmuka mengikuti role OWNER, ADMIN, TREASURER, AUDITOR, MEMBER, dan VIEWER. Hak tulis tetap divalidasi di database/RPC, bukan hanya dengan menyembunyikan tombol.

### Navigasi aplikasi

Fitur dipisahkan menjadi halaman Dashboard, Akun Keuangan, Transaksi, Rekonsiliasi Kas, Anggaran, Dana Bersama, Target Tabungan, Transaksi Berulang, Notifikasi, Anggota & Akses, Laporan & Audit, dan Profil. Menu administrasi workspace hanya tersedia untuk OWNER/ADMIN; menu laporan dan audit tersedia untuk OWNER/ADMIN/AUDITOR; rekonsiliasi dan anggaran tersedia untuk OWNER/ADMIN/TREASURER/AUDITOR. Menu lain menampilkan data sesuai keanggotaan workspace, sedangkan operasi tulis tetap dibatasi oleh role di database.

### Fitur yang tersedia

- Autentikasi email/kata sandi Supabase dan sesi sisi server.
- Multi-workspace dan enam role: OWNER, ADMIN, TREASURER, AUDITOR, MEMBER, VIEWER.
- Akun keuangan, saldo berbasis ledger, pemasukan, pengeluaran, transfer atomik, dan pembalikan transaksi tervalidasi.
- Audit aktivitas workspace dan rekonsiliasi kas.
- Anggaran berdasarkan periode, mata uang, dan akun.
- Dana bersama: komitmen, pencatatan iuran, pengeluaran yang dibatasi saldo, serta progres anggota.
- Target tabungan dengan setoran/penarikan sebagai transfer ledger.
- Template transaksi berulang dengan eksekusi manual dan log idempoten.
- Notifikasi transaksi dengan status baca per pengguna.
- Undangan workspace berbasis email terverifikasi, token kedaluwarsa, penerimaan dan perpanjangan undangan.
- Grafik arus kas 12 bulan dan ekspor transaksi POSTED ke CSV.

### Status database

Migrasi untuk anggaran, dana bersama, target tabungan, transaksi berulang, notifikasi, dan undangan telah diterapkan pada project Supabase utama. Setelah migrasi, tabel baru diverifikasi tersedia dan seluruh tabel publik yang relevan melaporkan RLS aktif.

Migrasi yang diterapkan mencakup:
- `0007_workspace_budgets.sql`
- `0008_pooled_funds.sql`
- `0009_savings_goals.sql`
- `0010_recurring_transactions.sql`
- `0011_notifications.sql`
- `0012_workspace_invitations.sql`
- `20261107053000_workspace_invitation_renewal.sql`

Database utama sudah berisi data workspace dan transaksi. Jangan menghapus, mereset, atau mengganti data tersebut saat pengembangan.

### Batasan yang masih diketahui

- Eksekusi transaksi berulang masih manual. Scheduler/cron otomatis belum dikonfigurasi.
- Undangan menghasilkan tautan untuk dibagikan; pengiriman email otomatis belum diintegrasikan.
- Ekspor yang tersedia saat ini adalah CSV. Ekspor PDF/XLSX, lampiran file, avatar/profil lengkap, dan pengaturan workspace lanjutan masih perlu dikembangkan.
- Perlu uji end-to-end tambahan pada alur UI, email, akses multi-role, dan skenario kegagalan sebelum menyatakan aplikasi siap produksi.
- Advisor Supabase masih melaporkan beberapa temuan keamanan/performa yang perlu ditinjau. Jangan menghapus kontrol SECURITY DEFINER tanpa memeriksa fungsi otorisasi yang dipanggilnya.
- Perlindungan kata sandi bocor di Supabase Auth masih nonaktif pada konfigurasi project.

## Teknologi

- Next.js App Router, React, TypeScript
- Supabase Auth, PostgreSQL, Row Level Security, SQL RPC
- Tailwind CSS, Recharts, Lucide
- GitHub Actions dan Vercel

## Menjalankan secara lokal

1. Gunakan Node.js 20.9 atau lebih baru.
2. Pasang dependensi: `npm install`.
3. Salin `.env.example` menjadi `.env.local`.
4. Isi `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
5. Untuk CAPTCHA, isi `NEXT_PUBLIC_TURNSTILE_SITE_KEY` dengan Site Key Cloudflare. Masukkan Secret Key Cloudflare langsung di Supabase Dashboard, lalu aktifkan CAPTCHA untuk Auth.
6. Jalankan `npm run dev`.

## Variabel lingkungan

Variabel yang digunakan aplikasi:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (wajib untuk mengaktifkan pendaftaran)

Publishable key dan Turnstile Site Key memang dirancang untuk dipakai di browser. Aplikasi tidak membutuhkan service-role/secret key di browser. Jangan menaruh secret key di variabel `NEXT_PUBLIC_*` atau menyimpannya di Git.

## Vercel

- Repository: `PanciWartegX/PanciLedger`
- Project Vercel: `panciledger`
- Production Branch: `main`
- Domain: `panciledger.vercel.app`

Setiap perubahan pada `main` dapat memicu deployment utama. Pastikan status CI dan deployment diperiksa sebelum menganggap perubahan siap digunakan.

## Database dan keamanan

- Nilai uang disimpan dengan PostgreSQL `numeric`, bukan floating point.
- Perubahan saldo berasal dari ledger; jangan mengubah saldo akun secara langsung.
- Transaksi POSTED tidak dapat diedit atau dihapus secara langsung; koreksi dilakukan melalui alur pembalikan yang tervalidasi.
- Transfer menggunakan dua sisi transaksi yang dibuat secara atomik.
- RPC memeriksa role di database; RLS menjadi batas isolasi workspace.
- Tabel dan fungsi sensitif menggunakan grant minimum.
- Storage dan lampiran privat belum diimplementasikan.

## CI dan QA

GitHub Actions menjalankan:

1. Instalasi dependensi.
2. TypeScript check.
3. ESLint.
4. Build Next.js.
5. Bootstrap PostgreSQL 17 sementara dan lapisan Auth minimal.
6. Menjalankan semua migrasi dari database kosong.
7. Memverifikasi tabel, RPC inti, dan RLS.
8. Menguji isolasi workspace, hak role, idempotensi transaksi/anggaran, dana bersama, tabungan, notifikasi, dan undangan.

CI yang lulus membuktikan rangkaian migrasi dan pemeriksaan tersebut pada database uji sementara. CI tidak membuktikan seluruh alur UI, konfigurasi email, scheduler, atau semua skenario operasional sudah siap produksi.
