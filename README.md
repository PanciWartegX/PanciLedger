# PanciLedger

**PanciWartegX** — pengelolaan keuangan dalam beberapa ruang kerja.

Hak cipta © 2026 PanciWartegX. Seluruh hak dilindungi.

## Status pengembangan

Branch `main` berisi aplikasi Next.js App Router dengan autentikasi email/kata sandi Supabase, pembaruan sesi di sisi server, dashboard multi-ruang-kerja, pembuatan ruang kerja, pengaturan peran anggota, pembuatan akun keuangan, pencatatan pemasukan dan pengeluaran secara atomik, transfer antar-akun bermata uang sama, pembalikan transaksi tunggal, serta aktivitas audit ruang kerja.

Antarmuka pengguna menggunakan Bahasa Indonesia. Domain produksi yang dituju adalah **https://panciledger.vercel.app**.

Aplikasi masih dalam pengembangan. Fitur dana bersama, pembalikan transfer berpasangan, anggaran, target tabungan, transaksi berulang, laporan/ekspor, notifikasi, administrasi akun dan anggota, serta pengujian integrasi yang lebih luas belum selesai. Jangan anggap aplikasi siap produksi sebelum migrasi database dan alur Supabase diuji langsung.

## Teknologi

- Next.js App Router dan TypeScript
- Supabase Auth, PostgreSQL, Row Level Security, dan SQL RPC
- Tailwind CSS
- Recharts dan Lucide

## Menjalankan secara lokal

1. Gunakan Node.js versi 20.9 atau lebih baru.
2. Pasang dependensi dengan `npm install`.
3. Salin `.env.example` menjadi `.env.local`.
4. Isi `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` di `.env.local`.
5. Tinjau dan terapkan seluruh migrasi SQL di `supabase/migrations` secara berurutan pada project Supabase yang benar.
6. Atur Site URL dan Redirect URLs Supabase Auth untuk pengembangan lokal.
7. Jalankan `npm run dev`.

Publishable key memang dirancang untuk digunakan di browser dan tidak memberikan akses database tingkat tinggi. Row Level Security dan pemeriksaan otorisasi di server tetap wajib. Aplikasi saat ini tidak membutuhkan secret/service-role key Supabase. Jangan pernah memasukkan secret key ke variabel `NEXT_PUBLIC_*` atau menyimpannya di Git.

## Pengaturan Vercel

1. Hubungkan repository privat `PanciWartegX/PanciLedger` ke Vercel.
2. Pastikan nama project Vercel adalah `panciledger` agar domain bawaan yang dituju menjadi `panciledger.vercel.app`.
3. Gunakan branch `main` sebagai Production Branch. Branch `develop` dapat digunakan untuk Preview.
4. Pastikan `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` tersedia pada environment yang digunakan.
5. Di Vercel, buka **Project Settings → Domains** dan pastikan `panciledger.vercel.app` ditambahkan serta berstatus valid. Nama domain belum dianggap aktif hanya karena sudah ditulis di konfigurasi aplikasi.
6. Tambahkan `https://panciledger.vercel.app/auth/callback` ke Supabase Authentication → URL Configuration → Redirect URLs. Atur Site URL ke `https://panciledger.vercel.app` setelah deployment domain tervalidasi.
7. Uji pendaftaran, konfirmasi email, login, isolasi antar-ruang kerja, peran anggota, saldo akun, transaksi, transfer, pembalikan transaksi, pembuatan ruang kerja, dan logout.
8. Pertahankan deployment Preview sampai semua pengujian berhasil dan deployment Production disetujui.

Vercel mendeteksi Next.js secara otomatis. Perintah build yang digunakan adalah `npm run build`.

## Prinsip data dan keamanan

- Satu akun pengguna dapat mengelola beberapa ruang kerja.
- Keanggotaan dan peran ruang kerja ditegakkan oleh PostgreSQL RLS dan pemeriksaan sisi server.
- Nilai uang disimpan menggunakan PostgreSQL `numeric`, bukan floating point.
- Transaksi yang sudah dibukukan tidak dapat diubah; koreksi dilakukan melalui catatan pembalikan.
- Transfer terdiri dari dua sisi dan disimpan secara atomik.
- Deployment Preview dipertahankan sampai Production disetujui secara eksplisit.

## Validasi

CI menjalankan pemasangan dependensi, pemeriksaan tipe TypeScript, ESLint, dan build Next.js untuk push serta pull request ke branch `main` dan `develop`.

## Fitur yang direncanakan

Dana bersama/iuran, target tabungan, anggaran, transaksi berulang, laporan dan ekspor, notifikasi, lampiran aman, administrasi akun/anggota, serta cakupan pengujian yang lebih luas.
