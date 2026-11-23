# Pembenaran penulisan referensi: APA 7, IEEE, Harvard (rancangan singkat)

Disetujui pemilik produk pada 23 Nov 2026 ("tambahkan format dalam bentuk APA, IEEE, dan Harvard, nanti
bisa diganti sesuai keinginan User"; deploy menyusul). Ukuran: proyek, satu halaman baru dan satu modul
baru di `packages/shared`. Ini fitur baru di luar daftar awal, ditambahkan atas permintaan pemilik produk.

## Maksud

CekKutip menjawab "apakah referensi ini ada dan cocok". Mahasiswa juga perlu "apakah penulisannya benar
menurut gaya yang diminta kampus". Halaman `/format` menerima daftar referensi yang ditempel, lalu menulis
ulang tiap referensi dalam gaya pilihan pengguna (APA 7, IEEE, atau Harvard), menunjukkan apa yang berubah,
dan menyediakan hasil yang bisa disalin (dengan huruf miring untuk Word).

## Temuan yang membentuk rancangan

- Parser pemeriksa menyimpan **nama keluarga saja, tanpa inisial**. Referensi APA tidak bisa dibuat ulang
  dari hasil Parse. Mengubah Parse berarti mengubah skema, prompt Gemini, dan evaluasi. Maka fitur ini
  memakai **pembaca teks sendiri** (`refformat`) yang menyimpan nama lengkap dan inisial, terpisah dari
  pipeline pemeriksaan. Pipeline, `decide()`, dan evaluasi tidak tersentuh.
- Aturan gaya diperiksa pada 23 Nov 2026 ke sumber yang bisa dibaca: situs resmi APA (apastyle.apa.org),
  panduan IEEE dari perpustakaan Murdoch dan NJIT, dan panduan Harvard (Cite Them Right) dari Open University
  dan DMU. PDF resmi IEEE dan Newcastle tidak terbaca alat, jadi tidak dipakai. Panduan IEEE dan Harvard
  berbeda di beberapa detail (lihat "Pilihan saya").

## Tujuan

- Halaman `/format` dengan pilihan gaya (APA 7, IEEE, Harvard) yang bisa diganti kapan saja. Hasil berubah
  seketika, tanpa tombol kirim. Pilihan terakhir diingat di browser (hanya kemudahan, bukan data).
- **Semuanya di browser.** Tidak ada permintaan jaringan, tidak ada model bahasa, tidak ada yang disimpan
  atau dicatat. Ini mengikuti prinsip privasi dan prinsip 1 (tidak ada model yang memutuskan apa pun).
- **Artikel jurnal ditulis ulang penuh** dalam tiga gaya. Jenis lain (buku, skripsi, laman web, prosiding)
  dan teks yang tidak terbaca **tidak ditulis ulang**: teksnya dibersihkan seperlunya (spasi, nomor daftar,
  tautan DOI) dan diberi alasan. Abstain adalah fitur.
- Tiap hasil menunjukkan teks asli, teks hasil dengan bagian yang berubah ditandai (garis bawah, bukan
  warna saja), daftar perubahan per bagian (penulis, tahun, judul, sumber, DOI) dengan nilai sebelum dan
  sesudah, dan catatan untuk hal yang tidak bisa diputuskan aturan.
- Salin per referensi dan salin semua, dengan huruf miring (HTML, untuk Word) atau teks biasa. IEEE
  bernomor `[n]`. APA dan Harvard bisa diurutkan menurut abjad (pilihan, menyala secara bawaan karena itu
  aturan kedua gaya itu, dan terlihat jelas).
- Tampilan mengikuti sistem desain yang ada. Teks hanya dari templat. Kata terlarang tetap terlarang:
  hasil tidak menyebut referensi "salah", hanya "berbeda dari gaya X".

## Bukan tujuan

- Bukan pemeriksaan keberadaan. Tidak ada pencarian di Crossref, OpenAlex, atau Garuda. Isi referensi
  tidak diperiksa dan tidak diperbaiki (tahun, penulis, judul tetap seperti yang ditulis).
- Bukan buku, bab buku, skripsi, laman web, prosiding pada tahap ini. Bukan Vancouver, MLA, Chicago.
- Bukan penyingkatan nama jurnal untuk IEEE (butuh daftar singkatan resmi). Nama jurnal tetap utuh dan
  dicatat.
- Bukan huruf kecil pada judul secara otomatis. Nama diri dan singkatan tidak bisa ditebak aturan. Ada
  pilihan yang harus dinyalakan sendiri oleh pengguna, dengan peringatan untuk memeriksa nama diri.
- Tidak mengubah pipeline pemeriksaan, `Parse`, skema `ParsedReference`, atau `apa.ts`.

## Pilihan saya (bisa dikoreksi)

- **APA 7** mengikuti situs resmi APA: sampai 20 penulis ditulis semua, `&` dengan koma sebelumnya,
  judul huruf kecil, jurnal dan volume miring, rentang halaman dengan en dash, `Article N` untuk nomor
  artikel, DOI sebagai `https://doi.org/...` tanpa titik di akhir.
- **IEEE**: inisial di depan nama, `and` untuk dua penulis, koma sebelum `and` untuk tiga atau lebih,
  lebih dari enam penulis menjadi `A. Penulis et al.`, judul dalam tanda kutip dengan koma di dalamnya,
  `vol.`, `no.`, `pp.`, `Art. no.`, `doi: ...` dan titik di akhir. Bulan tidak ditulis karena tidak ada di
  teks asli.
- **Harvard** mengikuti pola Cite Them Right seperti dipakai panduan Open University dan DMU: inisial tanpa
  spasi (`D.G.`), `and` tanpa koma, tahun dalam kurung tanpa titik, judul dalam kutip tunggal, jurnal
  miring, `volume(isu), pp.`, `article N`, `Available at: https://doi.org/...`. Panduan kedua kampus
  berbeda soal titik di akhir tautan. Saya ikut contoh Open University (dengan titik). **Harvard berbeda
  antar kampus**, dan halaman bilang begitu.
- Empat penulis atau lebih di Harvard: semua ditulis (Open University membolehkan salah satu, dan
  menghapus nama tidak bisa dibatalkan). `et al.` yang sudah ada di teks asli tetap `et al.` dan dicatat.
- Nomor halaman tunggal dengan lima angka atau lebih, atau berawalan huruf, dibaca sebagai nomor artikel
  dan dicatat sebagai asumsi.
- Nama tanpa koma dengan tiga kata atau lebih tanpa inisial (banyak nama Indonesia) dibaca dengan kata
  terakhir sebagai nama keluarga, dan ditandai "periksa urutan nama".
- Berkas `.txt` dan `.bib` bisa diunggah atau dilepas di halaman ini (alat yang sama dengan halaman
  Check), supaya berkas yang dilepas di sini tidak dibuka browser dan daftar yang sedang dikerjakan tidak
  hilang.

## Pendekatan yang dipertimbangkan

1. **Pembaca teks khusus di `packages/shared`, jalan di browser** (dipilih). Murni, bisa dites tanpa jaringan,
   tidak menyentuh pipeline.
2. Memperluas `Parse` agar menyimpan nama lengkap lalu memakai `apa.ts`. Ditolak: menyentuh skema, prompt
   model, dan evaluasi yang sedang disiapkan.
3. Meminta model bahasa menulis ulang referensi. Ditolak: melanggar prinsip 1, dan hasilnya tidak bisa
   diaudit.

## Risiko yang diterima

- Membaca teks bebas itu heuristik. Pengaman: bila bagian wajib (penulis, tahun, judul, nama jurnal plus
  volume atau halaman) tidak terbaca, referensi tidak ditulis ulang dan alasannya disebut. Jenis yang
  dibaca ditampilkan di tiap hasil supaya salah baca terlihat. Prosiding konferensi tanpa kata kunci
  (misalnya "Advances in Neural Information Processing Systems, 30") akan terbaca sebagai jurnal.
- Aturan gaya Harvard dan IEEE berbeda antar kampus dan jurnal. Halaman menyebut sumber polanya dan
  menyarankan memeriksa pedoman kampus.

## Diserahkan ke pelaksana

Bentuk heuristik pembaca, nama berkas, tata letak CSS dalam sistem desain yang ada.
