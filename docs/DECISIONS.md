# Keputusan teknis

Format: tanggal, keputusan, alasan. Ambang final dan hash commit dicatat di bagian paling bawah setelah tuning.

## 2026-11-16

1. **Akar repo = folder kerja** (`d:\Projects\CekKutip - IYSA`), bukan subfolder `cekkutip/`. Nama paket npm `cekkutip`.
2. **Model Gemini:** `gemini-3.1-flash-lite` (status stable di halaman model Google AI Studio, dibaca 16 Nov 2026). ID `-preview` sudah dijadwalkan mati. Dibaca dari `GEMINI_MODEL`.
3. **Streaming NDJSON, bukan SSE.** SSE bawaan browser hanya GET, sedangkan teks pengguna tidak boleh ada di URL.
4. **TypeScript 5.9** (bukan 7.x yang terbit di npm). Alasan: kompatibilitas `typescript-eslint`. Ditinjau ulang bila perlu.
5. **Paket `shared` tidak di-build.** Server dan klien mengimpor sumber TypeScript langsung (`exports` menunjuk ke `src/index.ts`). Server dijalankan dengan `tsx` saat dev dan dibundel saat build produksi.
6. **Celah A (venue):** tambah `TAU_V` (awal 0,40). Baris 4 mensyaratkan venue tidak jelas berbeda. Disetujui pengguna 16 Nov 2026.
7. **Celah B (record dari DOI, skor judul di antara `TAU_L` dan `TAU_T`):** diperlakukan seolah melewati `TAU_T` untuk baris 4 dan 5. Disetujui pengguna 16 Nov 2026.
8. **OpenAlex:** kunci opsional, dikirim sebagai `Authorization: Bearer` agar tidak masuk URL. 403 `key_not_activated` diperlakukan sebagai kegagalan layanan (`check_failed`), bukan verdict.
9. **`npm audit` (16 Nov):** 7 temuan moderate di rantai `typescript-eslint` (minimatch). Hanya devDependency, tidak ikut ke image produksi. Ditinjau ulang di M6.
10. **`CROSSREF_MAILTO`:** belum ada jawaban dari pengguna. `.env.example` memakai placeholder. Tes memakai fixture. Email akun pengguna tidak dipakai tanpa persetujuan.

## 2026-11-16 (M1)

11. **Newsreader statis 500 dan 600**, bukan varian `opsz` (132 KB per gaya). Alasan: JS dan font awal harus ringan. Ukuran optik di brief hanya "bila tersedia".
12. **Gerbang `TODO` di build produksi** dilakukan oleh plugin Vite (`failOnTodoPlaceholders`). Pintu keluar `CEKKUTIP_ALLOW_TODO=1` hanya untuk build verifikasi lokal. Jangan dipakai di pipeline deploy.
13. **`@cekkutip/shared/normalize`** diekspor sebagai subpath terpisah supaya klien memakai normalisasi yang sama dengan server tanpa membawa zod ke bundel (chunk How it works turun dari 97 KB ke 7,6 KB).
14. **i18n buatan sendiri.** `en.ts` mendefinisikan tipe `Dict`, `id.ts` harus cocok dengan tipe itu. `copy.test.ts` memeriksa kesamaan kunci, kata terlarang, emoji, dan placeholder di kedua bahasa.
15. **"plagiarism" dan "misconduct"** muncul di UI karena copy deck mewajibkan kalimat "does not detect plagiarism" dan pernyataan "not findings of misconduct". Itu bertentangan dengan daftar kata terlarang di prinsip 3 bila dibaca harfiah. Saya membacanya sebagai: kata itu tidak boleh dipakai untuk menyifati referensi pengguna. Tes mengizinkannya hanya di daftar "does not do" dan kalimat pernyataan.
16. **Tombol Check belum tersambung** (dinonaktifkan) sampai M4. "N found" memakai hitungan sementara berbasis baris kosong (`lib/count.ts`) sampai pemisah bersama dibuat di M2.
17. **Contoh di How it works** memakai referensi Walters & Wilder (2023) dengan tahun dan jurnal sengaja diubah. Sisi record ditulis dari ingatan atas entri Crossref asli dan belum dijalankan lewat pipeline. Wajib dikonfirmasi di M4.

## 2026-11-16 (M2)

18. **`CROSSREF_MAILTO`:** alamat diberikan pengguna pada 16 Nov 2026 dan disimpan hanya di `.env` lokal (diabaikan git). Alamat itu tidak ditulis di repo, dokumentasi, atau perintah. Kode membacanya dari variabel lingkungan dan mengirimkannya ke Crossref sebagai parameter `mailto` dan di User-Agent.
19. **Konkurensi Crossref = 3, bukan 4.** Dokumentasi Crossref (dibaca 16 Nov 2026): pool polite 10 permintaan per detik dan 3 bersamaan, pool publik 5 per detik dan 1 bersamaan. Respons nyata pool publik mengiklankan `x-rate-limit-limit: 5`, `x-rate-limit-interval: 1s`, `x-concurrency-limit: 1`. Angka "10/detik untuk satu record dan 3/detik untuk daftar" di brief tidak ditemukan di dokumentasi. Klien memakai batas pool (polite bila ada `mailto`, publik bila tidak) dan menyesuaikan diri dari header, tidak pernah melebihi batas pool.
20. **doiRA:** DOI tak terdaftar dijawab HTTP 200 dengan `{"status":"DOI does not exist"}`, bukan 404. `Invalid DOI` diperlakukan sama. Status lain (misalnya `Unknown`) dianggap respons buruk, jadi `check_failed`, bukan verdict.
21. **OpenAlex berbiaya.** Satu pencarian sekitar $0,001. Anggaran gratis: $0,10 per hari per IP tanpa kunci (dibagi dengan semua pengguna di IP yang sama), $1 per hari dengan kunci gratis. Klien tidak pernah melampaui anggaran gratis: 429 dengan Retry-After panjang gagal cepat (`rate_limited`). **Saran: buat kunci gratis OpenAlex** dan isi `OPENALEX_API_KEY`. OpenAlex hanya cadangan Crossref, jadi pemakaiannya kecil.
22. **Pencarian OpenAlex memakai `search.title`**, bukan filter `title.search` (sudah usang, dan koma dalam judul memecah sintaks filter). Pencarian mencocokkan semua kata, sehingga judul dengan kata keliru dapat mengembalikan nol hasil. Rekaman nyata untuk judul karangan mengembalikan nol, sedangkan Crossref mengembalikan lima karya mirip.
23. **Kegagalan cadangan = `check_failed` (diterapkan di M3).** Bila Crossref tidak punya kandidat lolos skor tetapi OpenAlex gagal dijangkau, hasilnya `check_failed`, bukan `suspect`. Alasan: bukti yang hilang karena layanan gagal tidak boleh menjadi verdict (prinsip 2).
24. **Nama penulis OpenAlex** hanya punya `display_name`. Nama keluarga diambil sebagai kata terakhir (`authors`), nama lengkap disimpan di `authorsFull`. Pencocok penulis di M3 harus juga memeriksa token di `authorsFull` agar nama keluarga majemuk ("van der Berg") tidak salah.
25. **`MatchedRecord.authorsFull`** (opsional) ditambahkan ke skema bersama untuk tampilan dan format APA (P1).
26. **Subjudul Crossref** digabung ke judul record (`Judul: Subjudul`) bila belum ada di dalamnya. Pencocok judul memakai bagian sebelum titik dua bila kutipan tanpa subjudul (brief 6.4).
27. **Pemisah referensi ada di `packages/shared`**, bukan hanya di server, supaya angka "N found" di browser sama dengan yang diperiksa server. Klien mengimpor subpath `@cekkutip/shared/split` agar zod tidak ikut ke bundel.
28. **Larik `references` dari klien dianggap sudah terpisah.** Tiap item hanya dibersihkan (karakter tak terlihat, spasi, nomor daftar, NFC), tidak dipisah lagi. Item yang berisi beberapa referensi akan digabung menjadi satu.
29. **Cache:** LRU 24 jam di memori, dengan cache berkas opsional (`RETRIEVAL_CACHE_DIR`) untuk harness evaluasi. Kunci adalah SHA-256 dari kueri ternormalisasi, nilai hanya metadata publik. Hasil "tidak ditemukan" (404, DOI tak terdaftar, nol kandidat) ikut di-cache. Kegagalan layanan tidak pernah di-cache.
30. **Redirect** diikuti manual (maksimum 3) dengan pemeriksaan daftar putih host pada setiap lompatan.
31. **Fixture** direkam dari layanan nyata dengan `scripts/record-fixtures.ts` (pool publik, tanpa email). Daftar referensi Crossref dibuang agar kecil. Respons 429, 5xx, dan timeout bersifat sintetis di tes karena tidak bisa direkam dengan wajar.
32. **Uji langsung:** `scripts/smoke-live.ts` memanggil klien terhadap Crossref, OpenAlex, dan doi.org sungguhan. Dijalankan 16 Nov 2026 tanpa email dan tanpa kunci: sembilan langkah berhasil.

## Ambang final

Belum dituning. Nilai sementara: `TAU_T` 0,90, `TAU_A` 0,60, `TAU_L` 0,60, `TAU_V` 0,40. Diisi setelah `npm run eval:tune` pada dev set (M5): ambang, hash commit, tanggal.
