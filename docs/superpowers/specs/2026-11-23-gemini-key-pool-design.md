# Kunci Gemini cadangan di server (rancangan singkat)

Disetujui pemilik produk pada 23 Nov 2026. Ukuran: perubahan kecil.

## Maksud

Kunci Gemini bersama milik server punya batas harian. Saat kunci pertama habis, semua pengunjung
kehilangan pembaca AI sampai batasnya pulih. Pemilik produk membuat tiga kunci dari **tiga proyek
Google Cloud yang berbeda** (kuota gratis dihitung per proyek) dan ingin dua kunci lain menjadi
cadangan otomatis.

## Tujuan

- Server membaca `GEMINI_API_KEY` (kunci 1, tidak berubah), `GEMINI_API_KEY_2`, dan `GEMINI_API_KEY_3`.
- Satu pemeriksaan mencoba kunci berurutan. Pindah ke kunci berikutnya bila Google menjawab 429
  (batas habis) atau menolak kunci (401, 403, atau 400 "API key not valid").
- Kunci yang baru gagal dilewati selama 5 menit (di memori saja), supaya pemeriksaan berikutnya tidak
  membuang satu panggilan ke kunci yang sudah habis.
- Bila semua kunci gagal, perilaku sekarang tetap: pemeriksaan selesai dengan parser tanpa AI dan
  `aiIssue` memberi tahu (banner menawarkan kunci sendiri).
- `/api/config` melapor `aiAvailable: true` bila ada satu kunci saja.

## Bukan tujuan

- Bukan pembagian beban (round-robin): kunci cadangan hanya dipakai saat kunci di depannya gagal.
- Kunci yang dikirim pengunjung (header `x-gemini-key`) tidak masuk kolam ini. Ia tetap dipakai sendirian
  seperti sekarang dan tidak pernah jatuh ke kunci server.
- Tidak ada penyimpanan status kunci di disk, dan tidak ada tampilan status kunci di klien.

## Larangan (dari CLAUDE.md dan DECISIONS)

- Model bahasa tetap hanya mengekstrak field. Verdict, pemilihan kandidat, dan teks penjelasan tidak
  berubah. Kegagalan layanan tidak pernah menjadi `suspect` (kunci habis menjadi `aiIssue`, bukan verdict).
- Kunci tidak boleh disimpan, masuk log, atau muncul di respons. Kunci tidak ada di repo atau klien;
  `.env` tidak di-commit. Tes memakai kunci palsu.
- Pindah kunci hanya karena kunci bermasalah (429, 401, 403, 400 kunci tidak valid), bukan karena
  timeout, jaringan, atau galat 5xx (itu bukan salah kunci, dan sudah ada satu percobaan ulang).
- Host keluar tetap hanya yang diizinkan.

## Pendekatan yang dipertimbangkan

1. **Tiga variabel terpisah** (`GEMINI_API_KEY`, `_2`, `_3`). Dipilih: mudah diisi satu per satu di Render
   (`sync: false`), nama jelas, `GEMINI_API_KEY` lama tetap berlaku tanpa perubahan.
2. Satu variabel berisi daftar (`GEMINI_API_KEYS=a,b,c`). Sama kuat, tetapi satu rahasia panjang yang sulit
   diperiksa dan diganti sebagian di dasbor.
3. Round-robin. Tidak cocok dengan permintaan (cadangan) dan membuat ketiganya habis bersamaan.

## Keputusan pemilik produk

- Tiga variabel terpisah, kunci cadangan hanya saat kunci di depannya gagal, dan tiga kunci berasal
  dari tiga proyek berbeda (dikonfirmasi pemilik produk).

## Pilihan saya (bisa diubah)

- Masa lewat 5 menit untuk kunci yang gagal. Konstanta di `config/limits.ts`.
- Kunci yang diatur tetapi kosong atau hanya spasi dianggap tidak ada. Dua nilai kunci yang sama
  digabung menjadi satu.

## Diserahkan ke pembangun

Letak pembungkus kolam (usulan: berkas `clients/gemini-pool.ts` yang membungkus `GeminiClient` dan
memakai `ServiceUnavailableError.code` yang sudah ada), nama konstanta, dan isi tes, selama tiap
perilaku di atas punya tes yang gagal dulu.
