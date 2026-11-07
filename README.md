# PanciLedger

**PanciWartegX** — aplikasi pengelolaan keuangan untuk beberapa ruang kerja.

Antarmuka menggunakan Bahasa Indonesia dengan tema navy gelap dan aksen emerald. Target domain produksi: **https://panciledger.vercel.app**.

## Status pengembangan

PanciLedger masih dalam tahap pengembangan. Perubahan fitur terbaru berada pada branch `feature/cash-management-foundation` melalui [PR #2](https://github.com/PanciWartegX/PanciLedger/pull/2). PR tetap Draft sampai seluruh integrasi Supabase dan QA selesai.

### Fitur yang sudah tersedia di branch pengembangan

- Autentikasi email/kata sandi Supabase dan sesi sisi server.
- Multi-workspace dan enam role: OWNER, ADMIN, TREASURER, AUDITOR, MEMBER, VIEWER.
- Akun keuangan, saldo berbasis ledger, pemasukan, pengeluaran, transfer atomik, dan pembalikan transaksi tunggal.
- Audit aktivitas workspace dan rekonsiliasi kas.
- Anggaran berdasarkan periode, mata uang, dan akun.
- Dana bersama: komitmen, pencatatan iuran, pengeluaran yang dibatasi saldo, serta progres anggota.
- Target tabungan dengan setoran/penarikan sebagai transfer ledger.
- Template transaksi berulang dengan eksekusi manual dan log idempoten.
- Notifikasi transaksi dengan status baca per pengguna.
- Undangan workspace berbasis email terverifikasi, token kedaluwarsa, penerimaan dan perpanjangan undangan.
- Grafik arus kas 12 bulan dan ekspor transaksi POSTED ke CSV.

### Batasan yang masih diketahui

- Migrasi fitur baru belum diterapkan ke project Supabase hosted yang terhubung. CI menguji seluruh migrasi pada PostgreSQL 17 sementara; pengujian CI bukan pengganti uji integrasi pada project Supabase terpisah.
- Karena migrasi fitur baru belum diterapkan ke database hosted, modul anggaran, dana bersama, tabungan, transaksi berulang, notifikasi, dan undangan belum dapat dianggap aktif pada deployment yang memakai database tersebut.
- Eksekusi transaksi berulang masih manual. Scheduler/cron otomatis belum dikonfigurasi.
- Undangan menghasilkan tautan untuk dibagikan; pengiriman email otomatis belum diintegrasikan.
- Ekspor yang tersedia saat ini adalah CSV. Ekspor PDF/XLSX, lampiran file, avatar/profil lengkap, dan pengaturan workspace lanjutan masih perlu dikembangkan.
- Belum ada klaim siap produksi. Perlu uji end-to-end, verifikasi konfigurasi Supabase, backup, dan QA pengguna sebelum rilis.

## Teknologi

- Next.js App Router, React, TypeScript
- Supabase Auth, PostgreSQL, Row Level Security, SQL RPC
- Tailwind CSS, Recharts, Lucide
- GitHub Actions dan Vercel Preview

## Menjalankan secara lokal

1. Gunakan Node.js 20.9 atau lebih baru.
2. Pasang dependensi: `npm install`.
3. Salin `.env.example` menjadi `.env.local`.
4. Isi `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
5. Jalankan `npm run dev`.

Jangan mengarahkan aplikasi pengembangan ke database Production. Siapkan project Supabase Free terpisah untuk development/Preview bila ingin menguji fitur baru secara langsung. Tinjau backup, urutan, dan isi semua file di `supabase/migrations` sebelum menerapkannya ke project hosted. Jangan menjalankan migrasi fitur baru pada database yang berisi data pengguna tanpa persetujuan eksplisit dan rencana pemulihan.

## Variabel lingkungan

Variabel yang digunakan aplikasi:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Publishable key memang dirancang untuk dipakai di browser. Aplikasi tidak membutuhkan service-role/secret key di browser. Jangan menaruh secret key di variabel `NEXT_PUBLIC_*` atau menyimpannya di Git.

## Vercel

- Repository: `PanciWartegX/PanciLedger`
- Project Vercel: `panciledger`
- Production Branch yang dituju: `main`
- Branch pengembangan: `feature/cash-management-foundation`
- Domain target: `panciledger.vercel.app`

Deployment Preview digunakan untuk QA. Pastikan environment Preview menunjuk ke project Supabase development, bukan database Production. Production deployment dan migrasi database Production memerlukan persetujuan eksplisit setelah QA.

## Database dan keamanan

- Nilai uang disimpan dengan PostgreSQL `numeric`, bukan floating point.
- Perubahan saldo berasal dari ledger; jangan mengubah saldo akun secara langsung.
- Transaksi POSTED tidak dapat diedit atau dihapus secara langsung; koreksi dilakukan melalui alur pembalikan yang tervalidasi.
- Transfer menggunakan dua sisi transaksi yang dibuat secara atomik.
- RPC memeriksa role di server/database; RLS menjadi batas isolasi workspace.
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

CI yang lulus membuktikan rangkaian migrasi dan pemeriksaan tersebut pada database uji sementara. CI tidak membuktikan konfigurasi environment hosted, email delivery, scheduler, atau seluruh alur UI sudah siap produksi.
