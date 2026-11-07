# Blueprint Produk PanciLedger

**Aplikasi Pencatatan Uang Kas Kelas**

| Atribut | Nilai |
|---|---|
| Nama produk | PanciLedger |
| Tagline | Kelola kas kelas, transparan & mudah. |
| Stack target | Next.js App Router · Supabase (Postgres + Auth + RLS) · Vercel |
| Versi | 1.0 |
| Status | Final sebagai acuan kebutuhan; belum diimplementasikan |

> Dokumen ini adalah spesifikasi produk dan arahan pengembangan. SQL, nama RPC, dan struktur folder di dalamnya merupakan rancangan, bukan implementasi yang sudah berjalan.

## Daftar isi

1. Ringkasan
2. Tujuan dan ruang lingkup
3. Peran dan hak akses
4. Arsitektur
5. Modul fitur
6. Alur bisnis
7. Perhitungan kas
8. Model database
9. RPC
10. Keamanan dan RLS
11. Log registrasi
12. Struktur aplikasi target
13. Branding
14. Environment dan deployment
15. Roadmap
16. Checklist rilis
17. Keputusan terkunci

## 1. Ringkasan

PanciLedger adalah aplikasi web untuk mengelola uang kas kelas. Bendahara mencatat siswa, pembayaran, pengeluaran, dan laporan. Siswa memeriksa status kewajiban kas tanpa akun melalui token akses kelas.

Setiap kelas dikelola satu Bendahara Utama dan dapat dibantu beberapa Bendahara Wakil. Admin mengelola master sekolah, kode undangan, approval, dan log registrasi.

## 2. Tujuan dan ruang lingkup

### Tujuan

1. Digitalisasi pencatatan kas kelas.
2. Transparansi status pembayaran untuk siswa.
3. Otomatisasi perhitungan kewajiban, pembayaran, dan kekurangan.
4. Kontrol akses berlapis untuk Admin, Utama, dan Wakil.
5. Keamanan data dengan validasi server dan RLS.

### In-scope

- Login dan registrasi bendahara dengan kode undangan.
- Approval pendaftar untuk kelas yang sudah memiliki pemegang.
- Log registrasi permanen, termasuk akun yang ditolak dan dihapus.
- Dashboard bendahara: siswa, pengaturan kas, pembayaran, pengeluaran, laporan.
- Halaman publik cek kas menggunakan token.
- Pengaturan akun dan approval perubahan data sensitif.

### Out-of-scope

- Aplikasi mobile native.
- Payment gateway.
- Notifikasi otomatis push/WhatsApp/email ke siswa.
- Multi-bahasa.
- Ekspor/impor massal pada fase awal.

## 3. Peran dan hak akses

### Empat peran

| Peran | Deskripsi |
|---|---|
| Admin | Pengelola lintas sekolah: master sekolah, undangan, approval, log, reset password. |
| Bendahara Utama | Pemegang pertama kelas; mengelola kas dan memiliki kewenangan khusus atas wakil serta request gabung. |
| Bendahara Wakil | Co-bendahara dengan hak pengelolaan kas setara Utama, tanpa kewenangan istimewa Utama. |
| Siswa publik | Tanpa akun; membaca status kas kelas melalui token. |

### Matriks hak akses

| Fitur | Admin | Utama | Wakil | Siswa |
|---|:---:|:---:|:---:|:---:|
| Kelola master sekolah | Ya | Tidak | Tidak | Tidak |
| Generate kode undangan | Ya | Tidak | Tidak | Tidak |
| Approve/reject request gabung | Ya | Ya | Tidak | Tidak |
| Approve perubahan sensitif | Ya | Tidak | Tidak | Tidak |
| Reset password | Admin dapat memulai reset | Mandiri | Mandiri | Tidak |
| Kelola siswa | Tidak | Ya | Ya | Tidak |
| Atur nominal/periode kas | Tidak | Ya | Ya | Tidak |
| Kelola token kelas | Tidak | Ya | Ya | Tidak |
| Pembayaran/pengeluaran | Tidak | Ya | Ya | Tidak |
| Dashboard kas kelas | Tidak | Ya | Ya | Tidak |
| Angkat/turunkan wakil | Ya | Ya | Tidak | Tidak |
| Cek status via token | Tidak | Tidak | Tidak | Ya |

### Aturan kepemilikan

- Satu akun bendahara terikat pada satu kelas.
- Perpindahan kelas memerlukan approval admin.
- Satu kelas hanya memiliki satu Bendahara Utama aktif.
- Satu kelas dapat memiliki nol atau lebih Bendahara Wakil aktif.
- Nomor urut wakil unik per kelas.
- Utama dan Wakil memiliki hak operasional kas setara, kecuali hak istimewa yang disebutkan di atas.

## 4. Arsitektur sistem

### Komponen

**Browser / Next.js Client**
- Menampilkan UI, form, tabel, dan status.
- Tidak menjadi tempat validasi keamanan atau perhitungan kritis.

**Next.js Server di Vercel**
- Server Components, Server Actions, Route Handlers.
- Refresh sesi dan pemeriksaan akses.
- Memanggil Supabase dan RPC dengan konteks pengguna yang benar.

**Supabase**
- Auth email/password.
- PostgreSQL dan RLS.
- RPC untuk operasi atomik.
- Storage opsional untuk bukti pembayaran, jika kelak disetujui.

### Prinsip

1. Validasi server-side untuk semua operasi kritis.
2. RLS adalah lapisan isolasi utama; otorisasi juga diperiksa di server.
3. Role otoritatif tidak boleh berasal dari input user atau metadata yang dapat diedit user.
4. Timestamp disimpan UTC; tampilan memakai WIB.
5. Service-role/secret key hanya boleh berada di server dan tidak boleh dikirim ke browser.
6. RPC berprivilege tinggi memiliki grants minimum dan validasi caller.
7. Semua operasi multi-langkah yang saling bergantung harus atomik.

## 5. Modul fitur

### 5.1 Halaman publik — `/cek-kas`

Alur:
1. Siswa memasukkan token akses kelas.
2. Server memanggil RPC publik terkontrol untuk memvalidasi token.
3. Jika valid, tampil nama siswa, nomor absen, status lunas, dan jumlah kewajiban yang masih harus dibayar.
4. Jika token tidak valid, tampil pesan generik.

Tidak boleh ditampilkan: email bendahara, total uang kelas, nominal pengaturan kas, daftar pengeluaran, data profil bendahara, atau informasi internal.

Token sebaiknya disimpan dalam bentuk hash, dapat dirotasi, tidak dapat ditebak, dan dilindungi rate limit. Token mentah tidak perlu dikembalikan setelah proses verifikasi.

### 5.2 Autentikasi

- Login email/password melalui Supabase Auth.
- Logout dan refresh sesi dengan pola SSR yang benar.
- Route guard untuk `/dashboard` dan `/admin`.
- Status `pending` hanya dapat membuka halaman menunggu persetujuan.
- Status `active` mendapat akses sesuai role.
- Akun yang ditolak dihapus sesuai alur audit; log registrasinya tetap tersimpan.
- Jangan mengandalkan middleware sebagai satu-satunya pengaman.

### 5.3 Registrasi bendahara — `/daftar`

Form:
- Kode undangan.
- Nama lengkap.
- Email.
- Password.
- Tanggal lahir.
- Sekolah dari dropdown master sekolah aktif.
- Nama kelas, misalnya X-1 atau XI-12.

Validasi server:
1. Kode undangan ada, aktif, belum kedaluwarsa, dan kuota tersedia.
2. Sekolah terdaftar dan aktif.
3. Normalisasi nama kelas agar tidak terjadi duplikasi karena perbedaan spasi/huruf.
4. Jika kelas belum memiliki pemegang: buat kelas dan tetapkan pendaftar sebagai Utama aktif.
5. Jika kelas sudah memiliki Utama: buat pendaftar berstatus pending dan request gabung.
6. Tulis event registrasi ke log pada setiap transisi penting.
7. Lindungi operasi dari race condition dan pemakaian kode undangan bersamaan.

Pembuatan akun Auth dan record database harus ditangani dengan desain kompensasi/atomicity yang jelas karena layanan Auth dan transaksi Postgres tidak otomatis satu transaksi.

### 5.4 Dashboard bendahara — `/dashboard`

| Modul | Fungsi |
|---|---|
| Ringkasan | Saldo, total masuk/keluar periode berjalan, siswa yang belum lunas. |
| Kelola Siswa | CRUD siswa, nomor absen, tanggal lahir, status keanggotaan bila ditetapkan. |
| Atur Kas | Nominal, periode, jatuh tempo, tanggal efektif. |
| Token Akses | Buat, rotasi, nonaktifkan token kelas. |
| Pembayaran | Catat pembayaran per siswa, riwayat, status kewajiban. |
| Pengeluaran | Nominal, keterangan, tanggal, pencatat. |
| Laporan | Rekap masuk/keluar/saldo per bulan dan transaksi. |
| Kelola Wakil | Daftar, angkat, turunkan wakil; khusus Utama. |

### 5.5 Dashboard Admin — `/admin`

| Modul | Fungsi |
|---|---|
| Master Sekolah | CRUD nama, alamat, status aktif. |
| Kode Undangan | Generate kode, kuota, masa berlaku, aktif/nonaktif. |
| Request Registrasi | Approve/reject pendaftar kelas yang sudah ada pemegangnya. |
| Approval Perubahan | Approve/reject perubahan data sensitif. |
| Log Registrasi | Filter sekolah, kelas, event, tanggal, email. |
| Reset Password | Memulai alur reset password melalui Supabase Auth. |

### 5.6 Pengaturan akun — `/dashboard/pengaturan`

| Perubahan | Kebijakan |
|---|---|
| Reset password sendiri | Alur Supabase Auth. |
| Edit nama | Langsung, tervalidasi. |
| Edit tanggal lahir | Langsung, tervalidasi. |
| Ubah sekolah/kelas/role/posisi | Request approval admin. |

Perubahan sensitif tidak boleh dilakukan melalui update profil biasa.

## 6. Alur bisnis

### 6.1 Registrasi

1. User mengisi form.
2. Server memvalidasi undangan dan sekolah.
3. Sistem menentukan apakah kelas baru atau sudah ada pemegang.
4. Kelas baru: akun menjadi Utama aktif.
5. Kelas yang sudah ada: akun pending dan request gabung dibuat.
6. Semua transisi dicatat di log.
7. Request disetujui oleh Utama kelas atau Admin, siapa yang lebih dulu memutuskan.
8. Approve: pendaftar menjadi Wakil dengan nomor urut berikutnya.
9. Reject: akun Auth dan profil dihapus setelah log permanen tercatat.

Penolakan harus atomik dari sisi status request dan log. Jika penghapusan Auth gagal, sistem harus mencatat kondisi tertunda dan menyediakan proses rekonsiliasi; jangan mengklaim akun sudah terhapus.

### 6.2 Approval gabung kelas

- Pemutus: Utama kelas atau Admin.
- Hanya keputusan pertama yang berhasil berlaku.
- Approve menambahkan Wakil dengan urutan unik.
- Reject menghapus akun sesuai prosedur dan mempertahankan snapshot log.

### 6.3 Perubahan data sensitif

1. User mengirim request perubahan.
2. Server memvalidasi nilai yang diminta dan membuat approval session.
3. Admin meninjau request.
4. Approve mengeksekusi perubahan melalui prosedur khusus.
5. Reject menyimpan alasan/status.
6. Kedua hasil dicatat dalam audit log.

### 6.4 Pembayaran

1. Bendahara memilih siswa dan memasukkan nominal.
2. Server memvalidasi role, kelas, siswa, nominal, serta tanggal.
3. RPC mencatat pembayaran secara atomik.
4. Sistem menghitung ulang status kewajiban.
5. UI menampilkan nominal tercatat dan status terbaru.

### 6.5 Cek kas publik

Token valid menghasilkan daftar status siswa yang telah difilter. Token invalid memberikan error generik. Endpoint publik tidak boleh menjadi jalur untuk enumerasi kelas atau siswa.

## 7. Logika perhitungan kas

Blueprint awal menyebut nominal per periode, periode harian/mingguan/bulanan/tahunan, tanggal efektif, pembayaran terakhir, dan status lunas. Namun rumus sederhana `FLOOR(total_dibayar / nominal)` belum cukup untuk menggambarkan tunggakan, periode kalender, pembayaran parsial, dan perubahan tarif.

Sebelum implementasi, tetapkan:
- Tanggal mulai kewajiban tiap siswa.
- Jadwal periode dan tanggal jatuh tempo.
- Urutan alokasi pembayaran (disarankan kewajiban tertua terlebih dahulu).
- Penanganan pembayaran parsial dan pembayaran di muka.
- Perubahan nominal/periode dan versi pengaturan efektif.
- Kebijakan pembulatan, refund, koreksi, dan siswa keluar/masuk.
- Arti yang tepat dari “kurang”: jumlah yang masih harus dibayar, bukan sisa pembagian total pembayaran.

Output status ideal:
- Total kewajiban sampai tanggal acuan.
- Total pembayaran yang dialokasikan.
- Sisa kewajiban.
- Periode tertua yang belum lunas.
- Tanggal jatuh tempo berikutnya.

Contoh:
- Kewajiban terakumulasi Rp10.000 dan pembayaran teralokasi Rp10.000 → sisa Rp0.
- Kewajiban terakumulasi Rp10.000 dan pembayaran teralokasi Rp9.000 → sisa Rp1.000.
- Kewajiban terakumulasi Rp2.000 dan pembayaran teralokasi Rp1.000 → sisa Rp1.000.

Gunakan integer rupiah; jangan gunakan floating point. Periode bulanan/tahunan harus memakai operasi kalender, bukan durasi hari tetap.

## 8. Model database konseptual

Tabel yang direncanakan:

| Tabel | Tanggung jawab |
|---|---|
| `schools` | Master sekolah dan status aktif. |
| `invite_codes` | Kode undangan, kuota, masa berlaku, status. |
| `classes` | Kelas per sekolah dan token akses. |
| `profiles` | Profil user Auth, role, status, kelas, posisi bendahara. |
| `registration_requests` | Request gabung kelas. |
| `approval_sessions` | Approval perubahan data sensitif. |
| `registration_logs` | Snapshot permanen event registrasi. |
| `audit_log` | Audit perubahan dan tindakan sensitif. |
| `kas_settings` | Riwayat pengaturan nominal/periode berdasarkan tanggal efektif. |
| `students` | Siswa per kelas. |
| `payments` | Pembayaran siswa. |
| `expenses` | Pengeluaran kelas. |

Constraint minimum:
- Unique nama kelas per sekolah setelah normalisasi.
- Maksimal satu Utama aktif per kelas.
- Nomor urut Wakil unik per kelas.
- Nominal transaksi positif dan integer.
- Foreign key untuk menjaga integritas.
- Index untuk pencarian berdasarkan kelas, siswa, tanggal, status.
- Kebijakan delete/update yang mempertahankan histori dan audit.

Tabel log harus tetap menyimpan snapshot email/nama/sekolah/kelas meskipun profil dihapus. Hindari FK yang membuat log ikut terhapus.

## 9. RPC yang direncanakan

| Function | Tanggung jawab |
|---|---|
| `register_bendahara` | Validasi undangan, buat user/profil/kelas/request, tulis log. |
| `decide_registration_request` | Approve/reject request gabung kelas. |
| `get_class_status` | Validasi token dan mengembalikan data publik minimal. |
| `compute_student_status` | Hitung kewajiban, alokasi, dan sisa. |
| `record_payment` | Validasi dan catat pembayaran secara atomik. |
| `request_sensitive_change` | Membuat approval session. |
| `decide_approval_session` | Menerapkan atau menolak perubahan sensitif. |
| `monthly_summary` | Rekap pemasukan, pengeluaran, dan saldo. |

Setiap RPC wajib memiliki kontrak, validasi caller, grants minimum, search_path aman, penanganan error, serta test. RPC publik tidak boleh mengembalikan data internal.

## 10. Keamanan dan RLS

### Prinsip

1. RLS aktif pada seluruh tabel yang dapat diakses melalui Supabase API.
2. Tabel internal yang hanya diakses server tetap memiliki grants eksplisit dan diuji.
3. Profil hanya dapat dibaca sesuai kebutuhan; user tidak dapat mengubah role, status, class_id, school_id, bendahara_role, atau order secara langsung.
4. Semua RPC berprivilege tinggi memakai `SECURITY DEFINER` hanya bila benar-benar diperlukan, `SET search_path` aman, grants EXECUTE terbatas, dan validasi pemanggil.
5. Service-role key hanya di server.
6. Token divalidasi server-side, idealnya hash token di database.
7. Rate limit registrasi dan endpoint cek kas.
8. Audit untuk approval, pergantian bendahara, pengaturan kas, token, dan transaksi.
9. Uji akses lintas kelas, user anonim, user pending, dan manipulasi request.

### Helper authorization

Rencanakan helper setara:
- `is_admin()`
- `is_bendahara_of(class_id)`
- `my_class_id()`

Helper harus aman dari RLS recursion, tidak memberikan privilege escalation, dan mengembalikan false/null jika identitas tidak valid.

### Pengujian wajib

- Bendahara A tidak dapat membaca atau mengubah data kelas B.
- Wakil tidak dapat mengangkat wakil atau memutuskan request.
- User pending tidak dapat mengakses modul aktif.
- User tidak dapat mengubah role/kelas melalui REST API langsung.
- Siswa publik hanya menerima field yang diizinkan.
- Token salah/rotasi token tidak mengungkap data.
- Admin dapat mengelola lintas sekolah sesuai kewenangan.

## 11. Log registrasi

Log registrasi wajib permanen karena akun rejected dihapus.

Event:
- `registered`
- `pending_created`
- `approved`
- `rejected`
- `deleted`

Simpan snapshot email, nama, sekolah, kelas, kode undangan (pertimbangkan masking/retensi), pelaku, waktu, dan catatan. Batasi akses log untuk Admin. Jangan menyimpan password atau token autentikasi.

## 12. Struktur aplikasi target

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

Struktur ini adalah saran target, bukan source code yang sudah tersedia. Semua halaman sensitif harus melakukan pemeriksaan akses di server.

## 13. Branding

- Nama: PanciLedger.
- Tagline: Kelola kas kelas, transparan & mudah.
- Deskripsi: Aplikasi pencatatan uang kas kelas dengan pelaporan otomatis dan akses publik via token.
- Gunakan konstanta branding terpusat untuk title, metadata, navbar, dan footer.
- Nama package saat aplikasi diinisialisasi: `panci-ledger`.

## 14. Environment dan deployment

Environment target:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` atau publishable key sesuai versi Supabase yang digunakan.
- Secret/service-role key hanya jika benar-benar dibutuhkan di server; jangan pernah gunakan prefix `NEXT_PUBLIC_`.

Tahap deployment:
1. Buat project Supabase development dan konfigurasi Auth.
2. Terapkan migration ke development.
3. Buat akun Admin pertama melalui prosedur bootstrap aman.
4. Uji seluruh role dan alur.
5. Deploy Vercel Preview.
6. Konfigurasikan Auth Site URL/Redirect URLs untuk Preview.
7. UAT dan security review.
8. Production hanya setelah persetujuan eksplisit.

Backup dan restore harus diuji; jangan menganggap backup otomatis tersedia pada setiap paket. Pastikan ketentuan paket hosting sesuai penggunaan dan kebijakan provider saat deployment.

## 15. Roadmap

| Tahap | Deliverable |
|---|---|
| 0 | Review blueprint dan selesaikan isu terbuka |
| 1 | Setup repository, Next.js, environment, lint, typecheck |
| 2 | Database, constraints, helper, RLS, tests |
| 3 | Auth, registrasi, request, registration logs |
| 4 | Dashboard Admin dan approval |
| 5 | Dashboard Bendahara dan modul kas |
| 6 | Halaman publik cek kas via token |
| 7 | Pengaturan akun dan approval perubahan |
| 8 | Security testing, QA, UAT, polish |
| 9 | Preview deployment dan persetujuan Production |

Estimasi waktu bukan komitmen; sesuaikan dengan hasil analisis dan pengujian.

## 16. Checklist kualitas sebelum rilis

### Keamanan
- [ ] RLS/grants seluruh tabel diperiksa.
- [ ] Secret tidak ada di client bundle atau Git.
- [ ] RPC memiliki search_path aman dan EXECUTE grants minimum.
- [ ] Token publik aman, dapat dirotasi, dan rate limited.
- [ ] Kolom sensitif tidak dapat diubah langsung.
- [ ] Rate limiting registrasi dan cek kas aktif.
- [ ] Akses lintas kelas ditolak.

### Fungsional
- [ ] Perhitungan kewajiban diuji dengan kasus tunggakan dan parsial.
- [ ] Registrasi reject menghapus akun sesuai prosedur dan log tetap ada.
- [ ] Approval perubahan sensitif berjalan.
- [ ] Log registrasi dapat difilter Admin.
- [ ] Token custom unik dan dapat dirotasi.
- [ ] Halaman publik hanya menampilkan allowlist data.

### Edge cases
- [ ] Dua pendaftar membuat kelas sama bersamaan.
- [ ] Dua pemutus menyetujui request yang sama bersamaan.
- [ ] Pembayaran berulang/idempotensi.
- [ ] Perubahan nominal di tengah periode.
- [ ] Siswa masuk/keluar di tengah periode.
- [ ] Token dirotasi ketika sedang digunakan.
- [ ] Penghapusan akun tidak menghapus histori.
- [ ] Zona waktu dan batas bulan/tahun.

### Operasional
- [ ] Backup dan restore diuji.
- [ ] Timestamp UTC dan tampilan WIB benar.
- [ ] Environment variables terdokumentasi tanpa secret.
- [ ] Admin bootstrap aman.
- [ ] Preview diuji sebelum Production.

## 17. Keputusan yang sudah dikunci

| # | Poin | Keputusan |
|---|---|---|
| 1 | Akun ditolak | Rejected, akun Auth/profil dihapus sesuai prosedur, log permanen dipertahankan. |
| 2 | Kepemilikan kelas | Satu Utama dan beberapa Wakil. |
| 3 | Validasi registrasi | Wajib di server dan atomik sejauh batas layanan memungkinkan. |
| 4 | Token kelas | Dibuat custom oleh bendahara; harus unik dan dapat dirotasi. |
| 5 | Perubahan sensitif | Melalui approval admin. |
| 6 | Cakupan admin | Lintas sekolah. |
| 7 | Log registrasi | Wajib dan permanen. |
| 8 | Stack | Next.js + Supabase + Vercel. |
| 9 | Nama | PanciLedger. |

---

**Akhir Blueprint v1.0.** Perubahan kebutuhan berikutnya dicatat sebagai revisi 1.1, 1.2, dan seterusnya. Dokumen ini menjadi acuan utama sampai revisi disetujui.
