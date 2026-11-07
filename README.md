# PanciLedger

> **Kelola kas kelas, transparan & mudah.**

PanciLedger adalah rancangan aplikasi web pencatatan uang kas kelas. Repository ini sengaja disiapkan sebagai **dokumen arahan dan fondasi pengembangan**, bukan aplikasi yang sudah berjalan.

## Status repository

<badge>Dokumentasi / pre-development</badge>

- Implementasi aplikasi lama telah dihentikan dan tidak dipertahankan di branch ini.
- Repository ini berisi spesifikasi produk, aturan kerja developer/AI, arsitektur target, dan rencana implementasi.
- **Belum ada aplikasi yang dapat dijalankan.** Tidak ada package manifest, source code, migration aktif, workflow CI, atau konfigurasi deployment.
- Jangan menyatakan fitur telah selesai, diuji, atau aman sebelum benar-benar diimplementasikan dan diverifikasi.

## Mulai membaca

1. **[Blueprint Produk](docs/BLUEPRINT.md)** — spesifikasi kebutuhan, peran, modul, alur bisnis, skema data konseptual, RPC, RLS, dan kriteria rilis.
2. **[Panduan Pengembangan](docs/DEVELOPMENT_GUIDE.md)** — urutan kerja, keputusan arsitektur, standar implementasi, pengujian, dan deployment.
3. **[Instruksi Agen / Kontributor](AGENTS.md)** — aturan wajib untuk developer manusia maupun AI coding agent.

## Ringkasan produk

- Admin mengelola master sekolah, kode undangan, approval, dan log registrasi.
- Satu kelas memiliki satu Bendahara Utama dan dapat memiliki beberapa Bendahara Wakil.
- Bendahara mengelola siswa, pengaturan kas, pembayaran, pengeluaran, token akses, dan laporan.
- Siswa tidak perlu membuat akun; mereka memeriksa status kas melalui token kelas.
- Perubahan data sensitif membutuhkan persetujuan admin.

## Stack target

- Next.js App Router + TypeScript
- Supabase Auth + PostgreSQL + Row Level Security + SQL RPC
- Vercel untuk hosting web

Stack ini adalah keputusan target, bukan bukti bahwa integrasi telah dibuat.

## Aturan penting

- Blueprint adalah sumber kebutuhan produk. Jika ada perubahan, buat revisi dokumen dan catat alasannya.
- Jangan menghidupkan kembali konsep multi-workspace finance app dari implementasi terdahulu.
- Jangan menambahkan source code, migration, konfigurasi framework, atau deployment sebelum ada instruksi implementasi yang jelas.
- Jangan menganggap contoh SQL konseptual sebagai migration siap produksi.
- Jangan pernah menaruh Supabase service-role/secret key di browser, repository, atau variabel `NEXT_PUBLIC_*`.
- Semua akses lintas kelas, perubahan role, token publik, dan perhitungan kas wajib dirancang dengan validasi server dan RLS.

## Rencana tingkat tinggi

1. Review dan finalisasi spesifikasi serta isu terbuka.
2. Rancang skema PostgreSQL dan threat model.
3. Implementasikan fondasi database, helper, RPC, dan RLS.
4. Implementasikan autentikasi dan registrasi bendahara.
5. Implementasikan dashboard admin dan approval.
6. Implementasikan dashboard bendahara dan seluruh modul kas.
7. Implementasikan pemeriksaan kas publik berbasis token.
8. Jalankan pengujian keamanan, integrasi, dan penerimaan.
9. Deploy Preview; Production hanya setelah persetujuan eksplisit.

Lihat dokumen pengembangan untuk detail dan gerbang penerimaan.

---

**PanciLedger · Blueprint v1.0 · Status: arahan pengembangan, belum diimplementasikan**
