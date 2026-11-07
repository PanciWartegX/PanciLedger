# Panduan Pengembangan PanciLedger

Dokumen operasional untuk mengubah blueprint menjadi aplikasi secara bertahap. Spesifikasi produk lengkap berada di [BLUEPRINT.md](BLUEPRINT.md).

## 1. Prinsip desain

1. **Database is the authority.** PostgreSQL constraint, RLS, grants, dan RPC menjaga integritas serta otorisasi.
2. **Server-first.** Validasi bisnis dan operasi sensitif dilakukan di server/database.
3. **Least privilege.** Setiap role hanya menerima hak minimum yang diperlukan.
4. **Auditability.** Keputusan approval dan transaksi penting harus dapat ditelusuri.
5. **Fail closed.** Jika identitas, role, status, atau kepemilikan tidak dapat dipastikan, tolak operasi.
6. **No false completion.** Status fitur hanya boleh berubah menjadi selesai setelah diuji.

## 2. Komponen target

- Next.js App Router + TypeScript untuk UI, Server Components, Server Actions/Route Handlers.
- Supabase Auth untuk identitas bendahara dan admin.
- PostgreSQL sebagai sumber data utama.
- RLS untuk isolasi kelas dan role.
- SQL RPC untuk operasi atomik dan aturan bisnis kritis.
- Vercel untuk Preview dan Production deployment.

Gunakan Supabase server/client helper yang sesuai pola SSR resmi saat implementasi. Middleware hanya membantu refresh/redirect sesi; otorisasi harus diulang di server dan database.

## 3. Model domain

Entitas utama:
- `schools`: master sekolah.
- `classes`: kelas dalam satu sekolah, dengan token akses publik.
- `profiles`: profil yang terkait dengan `auth.users`, role, kelas, status, dan data bendahara.
- `invite_codes`: kode undangan dan kuota.
- `registration_requests`: permintaan bergabung ke kelas yang sudah memiliki bendahara utama.
- `approval_sessions`: permintaan perubahan data sensitif.
- `registration_logs`: jejak registrasi permanen dengan snapshot.
- `audit_log`: jejak tindakan penting.
- `students`: daftar siswa per kelas.
- `kas_settings`: versi nominal/periode kas dengan tanggal efektif.
- `payments`: pembayaran siswa.
- `expenses`: pengeluaran kelas.

Relasi, kolom, constraint, index, dan aturan penghapusan harus dirinci dalam migration berdasarkan blueprint. Jangan menyalin SQL contoh tanpa review.

## 4. Role dan otorisasi

### Admin
Mengelola master sekolah, undangan, approval, log registrasi, dan reset password melalui alur aman.

### Bendahara Utama
Mengelola data kelas dan kas, mengangkat/menurunkan wakil, serta memutuskan permintaan bergabung ke kelas.

### Bendahara Wakil
Mengelola siswa, pengaturan kas, pembayaran, pengeluaran, token, dan laporan. Tidak dapat mengelola wakil atau memutuskan request gabung kelas.

### Siswa publik
Tidak memiliki akun. Hanya dapat membaca status kas minimal melalui token kelas yang valid.

Seluruh pemeriksaan harus mempertimbangkan status akun aktif. Akun pending tidak boleh memperoleh akses dashboard normal.

## 5. Urutan roadmap

### Tahap 0 — Analisis dan keputusan
- Review blueprint.
- Selesaikan isu perhitungan kas dan kebijakan data.
- Definisikan threat model, klasifikasi data, retensi, backup, dan kriteria penerimaan.

**Gerbang:** keputusan bisnis kritis terdokumentasi.

### Tahap 1 — Fondasi repository dan aplikasi
- Inisialisasi Next.js App Router + TypeScript.
- Konfigurasi lint, typecheck, build, environment validation.
- Siapkan Supabase SSR client/server helper.
- Buat layout, desain responsif, error/loading boundary.

**Gerbang:** aplikasi minimal dapat berjalan lokal dan build bersih.

### Tahap 2 — Database dan keamanan
- Buat migration master data, profil, registrasi, audit, siswa, kas, pembayaran, pengeluaran.
- Tambahkan foreign key, unique/check constraints, index.
- Aktifkan RLS seluruh tabel dan atur grants.
- Buat helper authorization dengan perlindungan terhadap recursion dan privilege escalation.
- Tambahkan test database untuk policy dan constraint.

**Gerbang:** migration dapat diterapkan pada database kosong; uji akses lintas kelas gagal sebagaimana mestinya.

### Tahap 3 — Auth dan registrasi
- Login email/password dan logout.
- Registrasi menggunakan kode undangan.
- Buat akun dan profil melalui alur server yang aman.
- Tangani kelas baru (Utama) dan kelas yang sudah ada (Pending).
- Catat semua event registrasi secara permanen.
- Terapkan rate limiting, anti-abuse, dan validasi email sesuai keputusan produk.

**Gerbang:** uji registrasi valid, kode invalid, kuota habis, kelas bentrok, duplikasi, dan race condition lulus.

### Tahap 4 — Admin
- CRUD sekolah.
- Generate/nonaktifkan kode undangan dan kuota.
- Approval/rejection request gabung kelas.
- Approval perubahan data sensitif.
- Filter log registrasi.
- Reset password melalui Supabase Auth flow yang aman.

**Gerbang:** admin dapat mengelola lintas sekolah; bendahara tidak dapat memanggil fungsi admin.

### Tahap 5 — Dashboard bendahara
- Ringkasan.
- CRUD siswa.
- Pengaturan nominal, periode, tanggal efektif, jatuh tempo.
- Token publik dan rotasi token.
- Pencatatan pembayaran dan riwayat.
- Pengeluaran.
- Laporan bulanan.
- Pengelolaan bendahara wakil oleh Utama.

**Gerbang:** setiap modul diuji sebagai Utama, Wakil, user pending, dan user kelas lain.

### Tahap 6 — Halaman publik
- Form token.
- Validasi token server-side.
- Daftar nama/nomor absen dan status pembayaran yang diizinkan.
- Rate limit, respons error generik, dan perlindungan enumerasi.
- Jangan tampilkan email bendahara, total kas, nominal kas, atau daftar pengeluaran.

**Gerbang:** token invalid tidak mengungkap keberadaan kelas; response hanya memuat data allowlist.

### Tahap 7 — Pengaturan akun
- Edit nama dan tanggal lahir.
- Reset password mandiri.
- Request perubahan sekolah/kelas/role melalui approval.
- Audit keputusan admin.

**Gerbang:** user tidak dapat mengubah kolom sensitif secara langsung.

### Tahap 8 — QA dan rilis
- Unit, integration, database, authorization, dan end-to-end tests.
- Uji race condition, pembayaran berulang, rotasi token, perubahan tarif, dan timezone.
- Review aksesibilitas, responsif, performa, logging, dan backup.
- Deploy Preview, lakukan UAT, lalu minta persetujuan Production.

**Gerbang:** seluruh checklist rilis di blueprint terpenuhi dan hasilnya terdokumentasi.

## 6. Rekomendasi struktur saat implementasi

Struktur berikut adalah target yang dapat disesuaikan setelah proyek dibuat; ini bukan file yang sudah ada:

```
src/
  app/
    (public)/
      page.tsx
      cek-kas/
    (auth)/
      login/
      daftar/
    dashboard/
      siswa/
      kas/
      pembayaran/
      pengeluaran/
      laporan/
      wakil/
      pengaturan/
      pending/
    admin/
      sekolah/
      undangan/
      request/
      approval/
      log-registrasi/
  components/
  lib/
    supabase/
    auth/
    validation/
    format/
  services/
  types/
supabase/
  migrations/
  tests/
docs/
```

Pisahkan UI, domain/service layer, validasi schema, dan akses data. Hindari menaruh seluruh logika di satu komponen atau satu Server Action.

## 7. RPC target

Rancangan fungsi yang perlu dianalisis dan diimplementasikan:
- `register_bendahara`
- `decide_registration_request`
- `get_class_status`
- `compute_student_status`
- `record_payment`
- `request_sensitive_change`
- `decide_approval_session`
- `monthly_summary`

Setiap fungsi harus memiliki kontrak input/output, validasi caller, grants EXECUTE minimum, definisi error, transaksi atomik, dan pengujian. Fungsi publik `get_class_status` hanya mengembalikan data minimum yang diizinkan.

## 8. Isu desain yang wajib diselesaikan sebelum implementasi kas

Blueprint v1.0 memberikan rumus awal, tetapi belum cukup untuk menghitung kewajiban kas secara benar dalam semua keadaan. Jangan mengasumsikan rumus tersebut benar tanpa keputusan produk.

1. **Periode kewajiban:** kapan periode pertama dimulai — tanggal konfigurasi, tanggal siswa masuk, atau tanggal kalender tertentu?
2. **Pembayaran parsial dan tunggakan:** apakah pembayaran dialokasikan ke kewajiban tertua terlebih dahulu? Bagaimana jika ada tunggakan beberapa periode?
3. **Makna “kurang”:** contoh blueprint menggunakan `sisa` sebagai jumlah kurang, padahal secara aritmetika sisa pembayaran adalah jumlah yang sudah dibayar menuju periode berikutnya. Definisikan `amount_due` secara eksplisit.
4. **Perubahan tarif:** bagaimana pembayaran lama dialokasikan saat nominal/periode berubah? Gunakan versi pengaturan yang efektif pada tanggal kewajiban, bukan hanya tanggal transaksi.
5. **Pembayaran di muka:** apakah kelebihan pembayaran menjadi kredit untuk periode berikutnya?
6. **Periode kalender:** mingguan, bulanan, tahunan memerlukan penambahan kalender yang benar; jangan menyamakan satu bulan dengan jumlah hari tetap.
7. **Tanggal jatuh tempo:** tetapkan aturan akhir pekan, hari libur, dan zona waktu.
8. **Edit/hapus transaksi:** tentukan kebijakan koreksi, reversal, dan audit.
9. **Siswa keluar/masuk kelas:** tetapkan tanggal efektif agar perhitungan tidak menagih periode di luar masa keanggotaan.

Buat contoh kasus dan expected result untuk setiap keputusan sebelum menulis fungsi perhitungan.

## 9. Keamanan tambahan yang perlu dirancang

- Simpan hash token akses, bukan token mentah bila memungkinkan; tampilkan token hanya saat dibuat/dirotasi.
- Rate limit berbasis IP dan token, tanpa menyimpan data pribadi berlebihan.
- Pertimbangkan CAPTCHA pada form publik/registrasi jika threat model membutuhkannya.
- Batasi panjang input, normalisasi nama sekolah/kelas, dan cegah enumeration.
- Jangan menghapus `registration_logs` saat profile/auth user dihapus; gunakan snapshot dan foreign key yang tidak menggantung.
- Hindari `SECURITY DEFINER` yang dapat dipanggil publik tanpa grant/pemeriksaan eksplisit.
- Gunakan audit untuk approval, pergantian pengurus, rotasi token, pengaturan tarif, dan koreksi transaksi.
- Definisikan backup, restore drill, retensi, serta prosedur insiden.

## 10. Kriteria selesai per fitur

Fitur hanya berstatus selesai jika:
- Acceptance criteria terdokumentasi.
- UI, server logic, database, dan policy terhubung.
- Error/empty/loading state tersedia.
- Unit/integration/authorization tests lulus.
- Tidak ada jalur bypass melalui direct Supabase API.
- Dokumentasi dan status roadmap diperbarui.
- Hasil diverifikasi di environment yang disebutkan.

## 11. Deployment

- Mulai dengan Vercel Preview.
- Simpan environment variable hanya pada environment yang tepat.
- Supabase Auth Site URL dan Redirect URLs harus sesuai domain Preview/Production.
- Jangan menjalankan migration destruktif pada Production tanpa backup dan rencana rollback.
- Production hanya setelah UAT, security review, backup/restore check, dan persetujuan eksplisit.

---

**Status:** panduan target. Tidak ada source code atau konfigurasi aplikasi yang disertakan di repository dokumentasi ini.
