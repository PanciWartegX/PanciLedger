# AGENTS.md — PanciLedger

Dokumen ini adalah instruksi kerja wajib untuk setiap developer, AI coding agent, reviewer, dan kontributor.

## 1. Misi

Bangun **PanciLedger**, aplikasi pencatatan uang kas kelas sesuai `docs/BLUEPRINT.md`. Produk ini bukan aplikasi keuangan pribadi, bukan multi-workspace ledger, dan bukan aplikasi kas umum.

## 2. Sebelum mengubah apa pun

1. Baca seluruh `README.md`, `docs/BLUEPRINT.md`, dan `docs/DEVELOPMENT_GUIDE.md`.
2. Periksa kondisi repository, branch aktif, commit terbaru, dan perubahan yang belum disimpan.
3. Identifikasi tahap roadmap saat ini dan deliverable yang belum terpenuhi.
4. Jangan mengarang konfigurasi Supabase, environment variable, kredensial, data sekolah, atau status deployment.
5. Jika detail penting bertentangan atau belum diputuskan, catat sebagai isu terbuka dan tanyakan hanya jika menghalangi pekerjaan.

## 3. Batas ruang lingkup

- Ikuti empat jenis akses: Admin, Bendahara Utama, Bendahara Wakil, dan siswa publik tanpa akun.
- Satu akun bendahara hanya terikat pada satu kelas.
- Satu kelas memiliki tepat satu Bendahara Utama aktif dan nol atau lebih Bendahara Wakil aktif.
- Utama dan Wakil mengelola kas dengan hak setara, kecuali kewenangan khusus yang ditetapkan blueprint.
- Siswa hanya dapat melihat informasi yang diizinkan melalui token kelas.
- Jangan menambahkan fitur di luar ruang lingkup tanpa persetujuan dan revisi blueprint.

## 4. Aturan keamanan yang tidak boleh ditawar

- Terapkan RLS pada setiap tabel yang dapat diakses melalui API Supabase. Tabel internal yang hanya diakses server tetap harus memiliki kebijakan/grant yang eksplisit dan diuji.
- Validasi identitas, role, status akun, kepemilikan kelas, input, dan transisi status di server/database; UI bukan batas keamanan.
- Jangan mempercayai role atau status yang dapat diubah user. Lindungi metadata otoritatif dan sinkronkan dengan kebijakan database.
- Semua RPC berhak istimewa harus memvalidasi pemanggil, memakai `SET search_path` yang aman, membatasi EXECUTE grants, dan menghindari kebocoran data.
- Jangan pernah mengekspos service-role/secret key ke client atau commit.
- Token publik harus disimpan dengan aman (utamakan hash token), tidak ditebak, dapat dirotasi, dan dilindungi rate limit.
- Jangan mengembalikan email bendahara, saldo kelas, pengeluaran, atau nominal kas ke endpoint publik.
- Gunakan transaksi database untuk operasi multi-langkah, unique constraint untuk invariant, serta mekanisme idempotensi untuk operasi yang dapat diulang.
- Audit perubahan penting. Jangan menghapus jejak registrasi saat akun ditolak.
- Jangan menganggap middleware sebagai satu-satunya lapisan otorisasi.

## 5. Aturan data dan uang

- Simpan nominal rupiah sebagai integer/BIGINT dengan validasi batas; jangan gunakan floating point.
- Semua timestamp disimpan sebagai timestamptz UTC. Zona waktu tampilan mengikuti WIB kecuali kebutuhan produk direvisi.
- Perubahan pengaturan kas harus memiliki tanggal efektif dan riwayat yang tidak ditimpa.
- Pembayaran harus dapat ditelusuri: siswa, kelas, nominal, waktu, pencatat, dan catatan.
- Koreksi transaksi harus memiliki jejak audit; jangan mengubah saldo secara manual.
- Jangan implementasikan rumus `lunas_sampai` dari blueprint secara literal sebelum aturan alokasi pembayaran, tanggal mulai kewajiban, tunggakan, pembayaran parsial, dan perubahan tarif disepakati. Lihat isu terbuka pada panduan pengembangan.

## 6. Cara implementasi

- Kerjakan per tahap kecil, dapat direview, dan dapat diuji.
- Database migration harus berurutan, dapat direproduksi pada database kosong, dan tidak mengubah data production tanpa rencana migrasi/backup.
- Setiap RPC baru harus disertai uji izin: pemanggil sah, role salah, kelas lain, user anonim, dan input tidak valid.
- Setiap modul UI harus memiliki loading, empty, success, validation, dan error state.
- Jangan membuat tombol atau menu palsu. Fitur yang belum tersedia harus dinyatakan belum tersedia.
- Perbarui dokumen status/roadmap setelah deliverable benar-benar diverifikasi.
- Jangan mengklaim CI, test, deployment, atau integrasi berhasil tanpa bukti aktual.

## 7. Gerbang kualitas sebelum merge

- TypeScript/typecheck, lint, build, dan test terkait lulus.
- RLS diuji untuk akses lintas kelas dan semua role.
- RPC privilege dan grants diperiksa.
- Tidak ada secret, data pribadi, atau file environment sensitif dalam diff.
- Migration dapat diterapkan dari kondisi database bersih.
- Perubahan dokumentasi sesuai implementasi; jangan mendokumentasikan perilaku yang belum ada.
- Preview diuji sebelum Production. Production memerlukan persetujuan eksplisit.

## 8. Komunikasi

Laporkan ringkas: apa yang diubah, file/migration yang terdampak, test yang dijalankan beserta hasilnya, risiko/isu tersisa, dan langkah berikutnya. Bedakan fakta terverifikasi dari asumsi.
