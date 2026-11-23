# Unduh .bib dari halaman Format (rancangan singkat)

Disetujui pemilik produk pada 23 Nov 2026 ("Lakukan yang pertama dan kedua juga"). Ukuran: proyek sedang,
dua modul baru di `packages/shared/src/refformat/` dan satu panel di halaman Format.

## Maksud

Orang akan memasukkan berkas `.bib` ke halaman Format, dan ingin berkas `.bib` yang sudah benar kembali
untuk dipakai di LaTeX, Overleaf, atau Zotero. Dua keperluan:

1. **Berkas `.bib` yang dibersihkan.** Kunci sitasi dan isi berkas tetap, hanya kesalahan yang jelas
   diperbaiki, dan hal yang butuh keputusan manusia diberi tanda.
2. **`.bib` baru dari teks.** Referensi yang ditempel sebagai teks bisa diunduh sebagai `.bib` (artikel
   jurnal yang terbaca, dengan kunci yang dibuat otomatis).

## Temuan dari berkas `.bib` milik pemilik produk (30 entri)

- Berkas `.bib` **tidak menyimpan gaya** (APA, IEEE, Harvard). Gaya dipasang belakangan oleh LaTeX atau
  Word. Jadi unduhan `.bib` sama untuk ketiga gaya, dan hanya datanya yang diperbaiki.
- Berkas itu memuat **siasat yang disengaja**: bulan ditulis di dalam `year` (`year = {Sep. 2025}`) supaya
  gaya `ieeetr` menampilkannya, dan `note = {doi: \url{...}}` di samping `url` dan `doi`. Pembersih yang
  "merapikan" semuanya akan merusak hasil cetaknya. Maka bawaannya **tidak menyentuh** keduanya.
- Kesalahan nyata: `journal = {Electronics (Basel).}`, daftar penulis rusak ditulis sebagai satu nama
  (`author = {{X. W. D. S. ... dan D. Z. Jason Wei}}`, kurung kurawal ganda), karya ganda dengan kunci
  berbeda (`wei2022a` dan `wei2022b`), `number = {0}`, dua `@article` yang bukan jurnal (arXiv dan
  prosiding), dan tanggal di masa depan.
- Pembaca yang ada mengubah `.bib` menjadi baris teks APA dan **membuang kunci dan field**. Untuk
  mengembalikan `.bib`, berkas asli harus disimpan dan diperbaiki langsung.

## Tujuan

- **Perubahan minimal pada teks asli.** Perbaikan dilakukan sebagai suntingan pada posisi tepat di teks
  berkas, jadi komentar, urutan, kunci, jarak, dan akhir baris (termasuk CRLF) yang tidak disentuh tetap
  persis sama. Bersihkan dua kali memberi hasil yang sama (idempoten).
- **Perbaikan otomatis hanya untuk yang jelas salah:** titik di ujung nama jurnal setelah tanda kurung,
  awalan tautan di field `doi`, rentang halaman tanpa `--`, "et al." atau "dkk." di daftar penulis
  (menjadi `and others`), titik di ujung `year`.
- **Dua saklar, mati secara bawaan,** untuk siasat yang bisa dipilih pengguna: pisahkan bulan dari `year`
  ke field `month` (makro `sep`, `oct`, ...), dan hapus `url` dan `note` yang hanya menggandakan DOI.
  Tiap saklar menyebut berapa entri yang terkena.
- **Tanda, bukan perubahan,** untuk: daftar penulis yang ditulis sebagai satu nama padahal berisi
  inisial, karya ganda (judul atau DOI sama), kunci ganda, `@article` yang jurnalnya arXiv atau prosiding,
  `number = {0}`, bulan dan tahun yang belum terjadi, dan field wajib yang hilang menurut jenis entri.
- **Tidak mengisi atau menebak data,** tidak mencari di jaringan, tidak mengganti kunci, tidak mengubah
  jenis entri, tidak mengubah huruf kapital judul.
- **`.bib` baru dari teks:** `@article` untuk artikel jurnal yang terbaca, kunci `keluarga` + tahun
  (`walters2023`, dengan `a`, `b`, ... bila kembar), penulis `Keluarga, Nama and ...` (`and others` untuk
  "et al."), judul dengan singkatan dan nama bercampur huruf dilindungi `{}` (kebiasaan baik BibTeX untuk
  gaya yang menurunkan huruf judul), karakter khusus (`&`, `%`, `$`, `#`, `_`) di-escape, `--` di
  rentang halaman, `doi` tanpa awalan. Referensi yang tidak bisa dijadikan entri (buku, skripsi, teks tak
  terbaca) **tidak dibuang diam-diam**: ditulis sebagai komentar `%` di akhir berkas.
- Semuanya di browser. Berkas dibaca dan ditulis di browser dan tidak dikirim ke mana pun. Unduhan memakai
  `Blob`.

## Bukan tujuan

- Bukan pengecekan keberadaan (Crossref, OpenAlex, Garuda) dan bukan mengisi field yang hilang.
- Bukan mengganti jenis entri secara otomatis (`@article` menjadi `@misc`), hanya menandai.
- Bukan melindungi singkatan di judul pada berkas yang sudah ada (hanya pada `.bib` baru dari teks).
- Bukan BibLaTeX, `@string` baru, atau menggabungkan beberapa berkas menjadi satu.

## Larangan (dari CLAUDE.md)

- Tidak ada teks pengguna ke server, log, atau layanan luar. Tidak ada model bahasa.
- Tampilan mengikuti sistem desain (tanpa emoji, gradien, bayangan, pil). Kata terlarang tetap
  terlarang.

## Pendekatan yang dipertimbangkan

1. **Pemindai yang mencatat posisi, suntingan pada teks asli** (dipilih). Perubahan minimal, aman untuk
   komentar dan format pengguna, dan tiap perubahan bisa ditunjukkan sebelum dan sesudahnya.
2. Mengurai lalu menulis ulang seluruh berkas dari `BibEntry`. Ditolak: komentar, urutan, dan format
   pengguna hilang, dan field yang tidak dikenal berisiko terbuang.
3. Menormalkan ke BibTeX baku secara bawaan (bulan ke `month`, buang `note`). Ditolak: merusak siasat
   `ieeetr` yang disengaja pada berkas yang diuji.

## Risiko yang diterima

- Pemindai posisi adalah kode baru untuk format yang punya banyak bentuk (nilai dengan `#`, kurung
  kurawal bersarang, `@string`). Pengaman: bila satu entri tidak terbaca, entri itu tidak disentuh,
  dan idempotensi dites.
- Heuristik tanda (penulis satu nama, karya ganda) bisa keliru dua arah. Karena hanya tanda, bukan
  perubahan, salah tanda tidak merusak berkas.

## Diserahkan ke pelaksana

Bentuk pemindai, nama berkas, tata letak panel.
