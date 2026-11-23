# Garuda sebagai sumber ketiga (rancangan singkat)

Disetujui pemilik produk pada 23 Nov 2026 ("Lanjutkan yang Garuda"). Ukuran: perubahan sedang, satu
sumber baru di tahap Retrieve. Fitur pembenaran penulisan referensi adalah proyek terpisah sesudah ini.

## Maksud

CekKutip memprioritaskan jurnal lokal Indonesia, tetapi Crossref dan OpenAlex hanya memuat artikel yang
didaftarkan penerbitnya. Contoh nyata: "Evaluasi Kinerja Algoritma Machine Learning (ML) Menggunakan
Seleksi Fitur pada Klasifikasi Diabetes" (Jurnal Informatika Polinema, Vol. 11 No. 3, 2025) ada di
jurnalnya dan di Google Scholar, tetapi tidak ada di Crossref (682 DOI jurnal itu diperiksa satu per
satu) maupun OpenAlex, sehingga diberi `suspect`. Garuda (garuda.kemdiktisaintek.go.id), indeks nasional
jurnal Indonesia, memuatnya.

## Yang diperiksa sebelum merancang (23 Nov 2026)

- Garuda tidak punya API. `/api`, `/oai`, `/documents.json` menjawab 404. Satu-satunya jalan adalah
  halaman hasil pencarian HTML (`/documents?q=...&select=title`). Tidak ada `robots.txt`.
- Garuda mencari dengan **semua kata harus ada** (urutan bebas, huruf besar kecil tidak berpengaruh).
  Satu kata yang salah ketik menghasilkan nol hasil. Satu halaman berisi paling banyak 10 hasil.
- Tiap hasil: judul, penulis (`Nama keluarga, Nama depan`, dan pemisahan itu kadang janggal untuk nama
  Indonesia), satu baris jurnal (`Nama Jurnal Vol. 11 No. 3 (2025): ...`, kadang dengan `||` dan
  keterangan tambahan), dan penerbit. Tidak ada DOI di halaman daftar. Kolom judul kadang berawalan
  kata kunci ("sistem pakar APLIKASI SISTEM PAKAR ...").
- Halaman selalu memuat penanda `Found N documents` (juga untuk N = 0).
- SINTA menjawab 403 untuk permintaan otomatis. Tidak dipakai dan tidak ditembus.

## Tujuan

- Garuda jadi sumber ketiga setelah Crossref dan OpenAlex, hanya bila keduanya tidak punya kandidat yang
  judulnya mencapai `TAU_L`, hanya untuk referensi yang dikutip seperti artikel jurnal (syarat yang sama
  dengan baris 6 `decide()`), dan hanya dengan judul (tidak ada teks lain yang dikirim).
- Rekaman Garuda memakai `MatchedRecord` yang sama (`source: 'garuda'`, tanpa DOI). Pencocokan,
  `decide()`, ambang, dan teks penjelasan **tidak berubah**.
- **Gagal tidak pernah menjadi `suspect`.** Garuda tidak terjangkau, menjawab 403/429/5xx, atau halaman
  tidak memuat penanda `Found N documents` (tampilan berubah) menjadi `check_failed`, bukan "tidak ada".
- Dibatasi sopan: satu permintaan pada satu waktu, jeda minimal 600 ms, cache, `User-Agent` generik,
  dan pemutus sirkuit: setelah satu kegagalan, Garuda dilewati selama 60 detik tanpa menghubungi jaringan,
  supaya Garuda yang mati tidak membuat pemeriksaan menunggu berlama-lama.
- Saklar `GARUDA_ENABLED=false` mematikannya tanpa mengubah kode (bila tampilan Garuda berubah).
- Bila judul penuh menghasilkan nol, dicoba sekali lagi dengan enam kata pertama yang bermakna
  (karena aturan "semua kata harus ada"). Kandidat tetap harus lolos ambang judul yang sama.
- Halaman bukti menampilkan "Garuda" dan tautan ke halaman artikel di Garuda. Halaman privasi, Cara
  Kerja, dan daftar host diperbarui.
- Evaluasi: saklar `useGaruda` di `PipelineOptions` dan ablation `a5` (tanpa Garuda).

## Bukan tujuan

- Bukan SINTA. Bukan pencarian berdasarkan penulis, abstrak, atau DOI di Garuda. Bukan filter tahun
  (karya dengan tahun yang salah dua tahun harus tetap ditemukan, supaya hasilnya `mismatch`).
- Tidak membaca halaman detail Garuda atau situs jurnal. Tidak ada halaman kedua dari hasil.
- Tidak mengubah ambang. Bila ambang perlu dituning ulang karena Garuda, itu hanya di dev set.

## Larangan (dari CLAUDE.md dan DECISIONS)

- Tidak ada teks referensi pengguna di log. Pesan galat klien tidak memuat URL.
- Host keluar hanya yang diizinkan: `garuda.kemdiktisaintek.go.id` ditambahkan atas permintaan pemilik
  produk (CLAUDE.md dan DECISIONS diperbarui).
- Tes tidak menyentuh jaringan. Hasil Garuda yang nyata direkam sebagai fixture.

## Pendekatan yang dipertimbangkan

1. **Garuda sebagai langkah ketiga di `retrieve()`** (dipilih). Pola sama dengan OpenAlex, perubahan
   `decide()` nol, beban ke Garuda kecil karena hanya yang tidak ketemu di dua sumber lain.
2. Garuda lebih dulu atau paralel dengan Crossref. Ditolak: membebani situs pemerintah tanpa perlu,
   dan Crossref lebih cepat dan lebih kaya untuk jurnal internasional.
3. Menurunkan `suspect` menjadi `out_of_index` untuk jurnal lokal. Ditolak: mengubah aturan keputusan
   agar hasil terlihat bagus, dilarang. Sumber data yang lebih lengkap adalah jawaban yang benar.

## Risiko yang diterima

- Membaca HTML itu rapuh. Pengaman: penanda halaman wajib, tes dengan fixture nyata, dan saklar.
- Syarat penggunaan Garuda tidak bisa dipastikan (tidak ada robots.txt, tidak ada API). Pemilik produk
  disarankan menghubungi pengelolanya sebelum deploy.
- Bila Garuda lambat atau mati, referensi jurnal yang tidak ada di Crossref dan OpenAlex menjadi
  "Could not check", bukan `suspect`. Itu sesuai prinsip produk nomor 2.

## Diserahkan ke pelaksana

Bentuk penguraian HTML, nama berkas fixture, urutan tes.
