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

## 2026-11-16 (M3)

33. **Arti "di atas" dan "di bawah" ambang:** "di atas" berarti `>=`, "di bawah" berarti `<`. Skor judul tepat di `TAU_T` dihitung cocok. Diuji pada nilai batas.
34. **Field yang tidak ditulis tidak pernah merugikan referensi.** Penulis, tahun, atau venue yang tidak dikutip (atau tidak ada di record) tidak dihitung "berbeda". `mismatch_venue` hanya muncul bila venue dikutip, ada di record, dan skornya di bawah `TAU_V`.
35. **Aturan bukti (tambahan).** `verified` mensyaratkan paling sedikit dua dari judul, penulis, dan tahun tertulis dan terbandingkan. DOI telanjang atau judul saja yang kebetulan cocok menghasilkan `out_of_index_insufficient_data`, bukan `verified`. Alasan: tanpa itu, DOI apa pun yang terdaftar akan "terverifikasi" tanpa ada yang dibandingkan. Aturan ini tidak ada di tabel brief. Beri tahu bila tidak setuju.
36. **Urutan baris 8 dan 9.** `out_of_index_other_registry` dan `out_of_index_insufficient_data` ditentukan oleh hasil Retrieve, jadi dievaluasi sebelum baris 3 sampai 7. Hasilnya sama dengan tabel karena kondisinya saling lepas.
37. **A1 (tanpa abstain)** mengubah status `out_of_index` menjadi `suspect` tetapi mempertahankan kode alasan aslinya agar jejak audit tetap terbaca.
38. **Record hanya ditampilkan bila verdict memang tentang record itu** (`verified` dan `mismatch`). Kandidat "hampir cocok" pada `suspect` dan `out_of_index` tidak ditampilkan, supaya pengguna tidak mengira itu sumbernya. Skornya tetap dikirim untuk bagian Details.
39. **Validasi keluaran model lebih ketat dari skema.** Selain zod, setiap DOI, judul, venue, penulis, tahun, volume, nomor, dan halaman dari model harus benar-benar tertulis di teks referensi (dibandingkan setelah normalisasi). Bila tidak, keluaran ditolak, diulang sekali sebagai panggilan tunggal, lalu jatuh ke parser regex. Ini menutup risiko model "melengkapi" DOI atau membetulkan judul.
40. **Gemini gagal dijangkau:** seluruh batch langsung dibaca parser regex tanpa mengulang per referensi (agar tidak membanjiri layanan yang sedang gagal). Hasil ditandai `parseMode: 'regex'`. Ini bukan `check_failed` karena pemeriksaan masih bisa dilakukan.
41. **Tanpa `GEMINI_API_KEY`** server tetap berjalan dan selalu memakai parser regex. `GET /api/config` melaporkan `aiAvailable: false` supaya antarmuka bisa jujur soal itu (dipakai di M4).
42. **Temperatur Gemini tidak dikirim secara bawaan** (menyimpang dari brief yang meminta 0). Dokumentasi Google yang dibaca 16 Nov 2026 menyebut `temperature`, `top_p`, dan `top_k` usang dan diabaikan pada keluarga Gemini 3, dan akan ditolak (HTTP 400) pada generasi berikutnya. Bisa diisi lewat `GEMINI_TEMPERATURE`. **Belum diuji dengan kunci nyata.** Determinisme dijaga oleh skema, instruksi sistem, dan validasi di butir 39.
43. **Parameter skema:** SDK `@google/genai` 3.3.0 memakai `responseMimeType` dan `responseJsonSchema` (JSON Schema biasa, tipe nullable ditulis `["string","null"]`). **Jalur Gemini nyata belum pernah dijalankan** karena belum ada kunci. Semua tes Parse memakai klien palsu.
44. **Model:** tetap `gemini-3.1-flash-lite` sesuai brief. Dokumentasi juga menyebut `gemini-3.5-flash-lite` yang lebih baru. Tidak diganti tanpa persetujuan. Cukup ubah `GEMINI_MODEL` bila mau.
45. **Mode eksperimen** (`system`, `ablation`) ditolak kecuali `ENABLE_EXPERIMENT_MODES=true`, dan selalu mati bila `NODE_ENV=production` apa pun isi variabelnya. Lewat HTTP hanya sistem `cekkutip` dan ablation `a1` sampai `a4`. Baseline B1 sampai B3 hanya ada di harness (M5).
46. **Logger tidak bisa mencatat teks.** `AppLogger` hanya punya metode bertipe tetap (id, jumlah, waktu, kode). Tidak ada metode yang menerima string bebas, objek permintaan, atau galat mentah. Dibuktikan tes: teks penanda di referensi tidak muncul di log pada pemeriksaan sukses, layanan gagal, masukan tidak valid, dan batas terlampaui.
47. **`TRUST_PROXY`** bawaan 1 di produksi (satu reverse proxy), 0 selain itu, agar batas laju memakai IP pengguna yang benar. Sesuaikan dengan host di M7.

### Hasil uji langsung M3 (16 Nov 2026, mode tanpa AI, pool publik Crossref)

`scripts/smoke-check.ts` mengirim 12 referensi ke server lokal yang memanggil layanan sungguhan. Ringkasan: 3 `verified`, 4 `mismatch`, 2 `suspect`, 3 `out_of_index`, 0 `check_failed`. Seluruh daftar selesai dalam sekitar 10 detik, hasil pertama tiba setelah sekitar 1,3 detik. Ini uji asap pada referensi pilihan saya sendiri, **bukan** ukuran akurasi.

Sebelas dari dua belas sesuai harapan. Satu tidak:

- **Masalah terbuka, Mismatch palsu:** `Vaswani et al. (2017). Attention is all you need. NeurIPS 30` (referensi benar) mendapat `mismatch_year` dengan selisih 8 tahun. Makalah asli tidak ada di Crossref. Crossref memuat lima unggahan ulang tahun 2025 bertipe `posted-content` dengan judul dan penulis yang sama. Aturan bekerja sesuai tabel, tetapi kesimpulannya keliru bagi pengguna. Aturan **tidak** diubah karena satu contoh. Pilihan yang menunggu keputusan pengguna: (a) biarkan dan ukur di dev set, (b) bila kandidat terbaik Crossref `mismatch`, cari juga di OpenAlex dan pakai kandidat yang cocok penuh bila ada (menambah biaya OpenAlex dan mengubah arti ablation A2). Apa pun pilihannya, referensi ini tidak boleh dipakai sebagai contoh `Verified` di daftar demo (M4).
- Pengamatan lain: buku Sugiyono (2017) benar menjadi `out_of_index`. Skripsi karangan mendapat kandidat mirip berskor 0,74 dan tetap `out_of_index`, sedangkan teks yang sama bergaya jurnal menjadi `suspect`.

## 2026-11-16 (M3, uji dengan Gemini nyata)

Butir 42 dan 43 di atas ditulis sebelum ada kunci. Butir berikut menggantikannya.

48. **Jalur Gemini nyata sudah diuji** (`scripts/smoke-gemini.ts`, lalu lewat server dengan `scripts/smoke-check.ts ... llm`). `gemini-3.1-flash-lite` menerima `responseMimeType`, `responseJsonSchema`, dan instruksi sistem. Enam referensi contoh (APA, skripsi, buku, IEEE, lembaga, dan satu referensi berisi perintah injeksi) semuanya lolos pemeriksaan "tertulis di teks". Referensi berisi perintah diperlakukan sebagai data.
49. **Temperatur bawaan 0**, sesuai brief. `temperature: 0` diterima API nyata pada 16 Nov 2026. `GEMINI_TEMPERATURE=off` berhenti mengirimnya bila model berikutnya menolak parameter itu. Keluaran model tetap bisa berbeda antar-batch walau temperatur 0 (lihat butir 51), jadi determinisme verdict dijaga oleh validasi dan aturan, bukan oleh model.
50. **Waktu model terukur:** sekitar 2,3 detik tetap ditambah sekitar 0,2 detik per referensi (1 referensi 2,5 detik, 4 referensi 3,2 detik, 8 referensi 4,2 detik). `thoughtsTokenCount` nol, jadi pengaturan thinking tidak membantu. Pemakaian token: 814 masuk dan 981 keluar untuk 8 referensi.
51. **Batch seimbang dan paralel.** Daftar dibagi menjadi batch sesedikit mungkin dengan ukuran serata mungkin (10 referensi menjadi 5 + 5, bukan 8 + 2) dan dibaca sampai 3 batch sekaligus. Pada 12 referensi waktu baca turun dari 10,2 detik menjadi 5,4 detik. Ukuran batch maksimum tetap 8.
52. **Instruksi venue diperketat.** Pada satu batch model mengisi "Repositori Universitas Contoh" sebagai venue sebuah skripsi, sehingga baris 6 ("ada nama jurnal") mengalahkan baris 7 dan skripsi itu menjadi `suspect`. Instruksi sekarang menyatakan venue hanya jurnal, prosiding, atau buku yang memuat bab, dan `null` untuk skripsi, buku, laporan, dan halaman web. Ini perbaikan Parse (definisi field), bukan perubahan aturan Decide. Setelah perbaikan, skripsi yang sama menjadi `out_of_index`.
53. **Kegagalan Parse dicatat sebagai kode** (`parse_rate_limited`, `parse_unfaithful_output`, dan sejenisnya) lewat `onError`, supaya jatuh ke parser regex tidak terjadi diam-diam. Tetap tanpa teks.
54. **Latensi per referensi** = bagian rata waktu baca batch ditambah waktu pencarian (termasuk antre di penjadwal Crossref). Angka ini yang dilaporkan sebagai `latencyMs`.

### Masalah pada aturan yang ditemukan uji langsung (diputuskan: lihat butir 55 sampai 57)

Ketiganya muncul dari uji langsung dan sama-sama menghasilkan tuduhan keliru pada referensi yang benar. Aturan tidak diubah berdasarkan contoh. Seharusnya diputuskan pengguna dan diukur di dev set.

- **T1, record lain berjudul sama.** `World Health Organization. (2021). Obesity and overweight. https://www.who.int/...` (halaman web yang benar) mendapat `mismatch_authors` + `mismatch_year`, karena Crossref punya artikel lain berjudul persis "Obesity and overweight". Judul pendek dan umum akan sering bertabrakan. Usul: bila judul cocok tetapi **tidak satu pun** penulis yang dikutip ditemukan (skor penulis 0), anggap itu karya lain, bukan karya yang sama dengan penulis keliru. Referensi lalu jatuh ke baris 6 atau 7 sesuai tipe. `mismatch_authors` tetap berlaku untuk kecocokan sebagian.
- **T2, Crossref hanya memuat unggahan ulang.** `Vaswani et al. (2017). Attention is all you need` mendapat `mismatch_year` (selisih 8 tahun) karena Crossref hanya punya unggahan ulang tahun 2025. Usul: bila kandidat terbaik Crossref `mismatch`, cari juga di OpenAlex dan pakai kandidat yang cocok penuh bila ada.
- **T3, venue pada tipe non-jurnal.** Baris 6 menganggap referensi "seperti jurnal" bila ada venue, termasuk bila tipenya skripsi, buku, laporan, atau halaman web. Butir 52 mengurangi kasusnya di Parse, tetapi parser regex dan model masih bisa mengisi venue. Usul: untuk tipe-tipe itu venue tidak dihitung sebagai "nama jurnal" (volume dan DOI tetap dihitung).

### Latensi dan risiko demo

- Dengan Gemini dan cache kosong, 12 referensi butuh 32 sampai 45 detik di pool publik Crossref (satu permintaan sekaligus, dan saat diuji tiap pencarian butuh 4 sampai 5 detik). Mode tanpa AI pada saat lain butuh sekitar 10 detik untuk daftar yang sama. Kecepatan Crossref berubah-ubah.
- Dengan hasil pencarian sudah di cache, daftar yang sama selesai dalam 5,4 detik (waktu model saja).
- **Belum diukur: pool polite** (dengan `CROSSREF_MAILTO`, tiga permintaan sekaligus). Saya tidak menjalankan server dengan alamat itu. Pengguna bisa mengukurnya dengan `npm run dev` lalu `npx tsx scripts/smoke-check.ts http://localhost:8787 llm`.
- Untuk demo ke juri: jalankan daftar demo sekali sebelum presentasi agar hasil pencarian ada di cache 24 jam. Ini dicatat di DEPLOY.md (M7).

## 2026-11-16 (T1 sampai T3 disetujui, lalu M4)

Pengguna menyetujui T1, T2, dan T3 pada 16 Nov 2026. Ketiganya diterapkan sebelum data evaluasi ada, jadi tidak disetel pada data uji. Dampaknya tetap harus diukur di dev set (M5).

55. **T1, tabrakan judul.** Kandidat hasil pencarian yang judulnya mencapai `TAU_T` tetapi tidak satu pun penulis yang dikutip ditemukan (skor penulis tepat 0, penulis dikutip, pengecekan penulis aktif) dianggap karya lain. Referensi jatuh ke baris 6 atau 7. `mismatch_authors` tetap berlaku bila sebagian penulis ditemukan. T1 tidak berlaku untuk record yang dicapai lewat DOI yang dikutip, dan tidak berlaku pada ablation A4. Saat memilih kandidat terbaik, kandidat yang lolos T1 didahulukan atas "kembaran" berjudul sama.
56. **T2, pandangan kedua ke OpenAlex.** Bila Crossref punya record berjudul cocok tetapi hasilnya bukan `verified` (yaitu `mismatch`, atau tabrakan judul menurut T1) dan OpenAlex belum dipakai, pipeline mencari judul itu di OpenAlex. Hasil OpenAlex dipakai **hanya bila `verified`**. Selain itu jawaban pertama tetap. Bila pandangan kedua gagal dijangkau, jawaban pertama tetap dan kegagalannya dicatat sebagai kode `second_look_*`. Alasannya: jawaban pertama bersandar pada record yang benar-benar ada di Crossref. Ini berbeda dari butir 23 (Crossref tidak punya apa-apa lalu OpenAlex gagal menjadi `check_failed`). A2 (tanpa OpenAlex) tidak melakukan pandangan kedua, jadi A2 sekarang juga mengukur nilai pandangan kedua.
57. **T3, venue pada tipe non-jurnal.** Untuk `thesis`, `book`, `book_chapter`, `report`, dan `web_page`, venue tidak dihitung sebagai "nama jurnal" pada baris 6. Volume dan DOI tetap dihitung. `conference_paper` dan `other` dengan venue tetap dianggap seperti jurnal.
58. **Biaya T2.** Setiap `mismatch` dan setiap tabrakan judul pada referensi tanpa DOI menambah satu pencarian OpenAlex (sekitar $0,001). Tanpa kunci OpenAlex, anggaran gratis $0,10 per hari per IP cepat habis. Kunci gratis OpenAlex sekarang sangat disarankan.

### Daftar contoh (apps/web/src/data/example-list.ts), dijalankan 16 Nov 2026

Sepuluh entri: lima nyata, satu nyata dengan tahun dan jurnal sengaja diubah, empat karangan (ditandai di komentar kode, memakai "Universitas Contoh" dan "Jurnal Contoh"). Verdict aktual dari pipeline terhadap layanan nyata, sama pada satu kali jalan tanpa AI dan empat kali jalan dengan Gemini:

| No  | Jenis                          | Verdict      | Kode alasan                   |
| --- | ------------------------------ | ------------ | ----------------------------- |
| 1   | nyata, ber-DOI                 | verified     | verified_all_match            |
| 2   | nyata, tahun dan jurnal diubah | mismatch     | mismatch_year, mismatch_venue |
| 3   | karangan, DOI tidak terdaftar  | suspect      | suspect_doi_not_found         |
| 4   | nyata, tanpa DOI               | verified     | verified_all_match            |
| 5   | karangan, skripsi              | out_of_index | out_of_index_type             |
| 6   | DOI nyata, judul karangan      | mismatch     | mismatch_doi_other_work       |
| 7   | nyata, buku                    | out_of_index | out_of_index_type             |
| 8   | karangan, artikel jurnal       | suspect      | suspect_no_record_journal     |
| 9   | nyata, tanpa DOI               | verified     | verified_all_match            |
| 10  | nyata, laporan pemerintah      | out_of_index | out_of_index_type             |

Dengan hasil pencarian sudah di cache, sepuluh referensi selesai dalam 4 sampai 5,5 detik dengan Gemini. Jalan pertama dengan cache kosong butuh sekitar 20 detik di pool publik Crossref. Tim tetap menyiapkan daftar demo akhirnya sendiri.

Entri nomor 2 juga dipakai sebagai contoh di halaman How it works. Sisi record di halaman itu (Scientific Reports, 2023, DOI) sekarang terkonfirmasi oleh pipeline. Butir 17 selesai.

### M4

59. **Klien mengirim larik referensi yang sudah dipisah** di browser dengan pemisah yang sama dengan server. Baris yang belum selesai menampilkan teks referensinya dan kata "Checking".
60. **Ledger adalah daftar berurut (`ol`)**, bukan `table`. Tiap baris bisa dibuka dan berisi tabel perbandingan yang sungguhan (`table` dengan `caption`, `th scope`). Tabel bersarang di dalam baris tabel lebih buruk untuk pembaca layar.
61. **Bilah ringkasan** adalah SVG dengan ukuran berupa atribut persen, sehingga tidak perlu gaya inline (CSP `style-src 'self'`). Bilah itu `aria-hidden`. Tombol hitungan di bawahnya adalah filter yang bisa diakses (`aria-pressed`).
62. **Galat ditampilkan dari kode ke teks tetap** (jaringan, berhenti di tengah, batas laju, batas jumlah). Banner memakai warna netral. Hasil yang sudah tiba tetap ditampilkan bila aliran terputus.
63. **Tanpa kunci AI di server**, kotak centang "tanpa AI" tercentang dan nonaktif, dan pemberitahuannya diganti dengan kalimat yang benar untuk keadaan itu.
64. **CSV** diawali BOM, memakai CRLF, dan menetralkan sel yang diawali `=`, `+`, `-`, `@` agar tidak dijalankan sebagai rumus oleh program lembar kerja.
65. **Tautan record** hanya dibuat dari DOI atau URL `https`. Tautan Google Scholar dibuat dari judul dan hanya terbuka bila pengguna mengekliknya.
66. **E2E tanpa jaringan.** `scripts/e2e-server.ts` membangun aplikasi web lalu menjalankan server sungguhan dengan cache pencarian rekaman (`apps/web/e2e/cache`, mode putar ulang saja), tanpa kunci AI dan tanpa alamat kontak. Berkas cache berisi metadata publik dengan nama berkas berupa hash. Referensi yang tidak terekam menghasilkan `check_failed`, dan itu dipakai untuk menguji status tersebut.
67. **"Copy corrected reference" (P1) belum dibuat.** Panel bukti menampilkan "Open record" dan "Search on Google Scholar".

### Uji langsung T1 dan T2 pada kasus aslinya (16 Nov 2026)

- **T1 bekerja.** Halaman WHO "Obesity and overweight" sekarang `out_of_index_type`, bukan `mismatch`.
- **T2 tidak mengubah kasus Vaswani (2017).** Hasilnya tetap `mismatch_year` (selisih 8 tahun). OpenAlex memang memuat versi 2017 dengan judul dan penulis yang cocok, tetapi sebagai pracetak dengan venue "arXiv (Cornell University)". Venue yang dikutip adalah prosiding NeurIPS, jadi hasil OpenAlex adalah `mismatch_venue`, bukan `verified`, dan menurut T2 jawaban pertama tetap. Kedua indeks tidak memuat versi prosidingnya.
- **Belum diputuskan (kandidat T4):** venue milik server pracetak (arXiv, SSRN, bioRxiv, dan sejenisnya) tidak dibandingkan sebagai venue. Ini tidak diterapkan. Sebaiknya dinilai di dev set, bukan dari satu contoh.
- T1 dan T2 selebihnya hanya teruji dengan data buatan di tes unit.

## 2026-11-18 (M5: harness evaluasi)

68. **Harness memanggil pipeline yang sama.** `runSystem` untuk `cekkutip` memanggil `runPipeline`. Ablation adalah sakelar di `PipelineOptions` (A1 abstain, A2 OpenAlex, A3 mode baca, A4 penulis), bukan salinan kode. Sistem hanya menerima `{ id, text }` (dibuktikan tes: id penanda dan label tidak muncul di panggilan model maupun URL pencarian).
69. **B2 (hasil teratas Crossref).** Kueri adalah seluruh teks referensi. Skor judul dihitung antara judul yang dibaca parser regex dan judul hasil teratas. Bila parser regex tidak menemukan judul, skor 1 jika teks memuat judul hasil kata demi kata, selain itu 0. Ambang dituning pada dev dengan kisi 0,50 sampai 0,95. Kegagalan layanan adalah `check_failed`, bukan `suspect`, juga untuk baseline.
70. **B3 (cek DOI).** DOI diambil dari teks dengan pembersih yang sama dengan pipeline. `verified` bila Crossref punya record, selain itu `suspect`. Tanpa DOI hasilnya `suspect`.
71. **B1 (model saja).** Model yang sama dan temperatur yang sama, dengan instruksi sistem yang menyatakan tidak ada alat pencari dan referensi adalah data. Jawaban di luar empat label diabaikan dan dicatat `check_failed`. Bila model tidak terjangkau, seluruh batch `check_failed`.
72. **Tuning.** Kisi: `TAU_T` {0,80, 0,85, 0,90, 0,95} × `TAU_A` {0,4 sampai 0,8} × `TAU_L` {0,5, 0,6, 0,7} × `TAU_V` {0,3, 0,4, 0,5}, hanya yang `TAU_L < TAU_T` (180 kombinasi). Referensi dibaca sekali, lalu tiap kombinasi menjalankan ulang pencarian (dari cache), pencocokan, dan aturan. Skor tertinggi menang. **Bila seri, yang terdekat dengan nilai awal yang dipilih**, supaya set dev kecil tidak menggeser ambang tanpa bukti. Skrip menolak split `test` (`--split test` keluar dengan kode 2 sebelum membaca data), dan `assertDevOnly` memeriksa lagi sebelum apa pun dibaca.
73. **Data templat tidak bisa menjadi hasil.** Berkas yang namanya memuat "template" ditandai `sample`. Hasilnya default ke `eval/results-sample/` (diabaikan git), dan skrip menolak menulisnya ke `eval/results/`. Ringkasan dari data contoh membawa `"sample": true`, dan laporan Markdown-nya diawali peringatan. Halaman Evaluation (M6) harus mengabaikan ringkasan bertanda `sample`.
74. **Metrik.** Macro-F1 dirata-rata hanya atas verdict yang muncul di label emas. `check_failed` dihitung salah, dan bukan tuduhan maupun abstain. False accusation rate dihitung atas referensi berlabel emas `verified` atau `out_of_index`, dan bernilai `null` bila tidak ada. Tingkat abstain dihitung atas semua referensi. Interval: bootstrap persentil 95%, 1.000 resampel, seed 20261209, resampel yang statistiknya tidak terdefinisi dibuang. Kappa tidak terdefinisi (`null`) bila kedua pelabel hanya memakai satu label.
75. **Cache evaluasi.** Pencarian di `eval/cache/retrieval` (cache berkas yang sama dengan server). Jawaban model di `eval/cache/model`, kuncinya hash dari (tujuan, model, teks), isinya keluaran model dan token per referensi. Berkas tidak memuat teks referensi. `--replay-only` tidak memakai jaringan dan model. Bukti: jalan ulang `--replay-only` pada data contoh memberi prediksi, macro-F1, interval, dan token yang identik.
76. **Latensi hanya bermakna pada jalan yang mengisi cache.** Pada jalan ulang, latensi turun dari ribuan ke belasan milidetik karena pencarian diputar ulang. Laporan memuat catatan ini. Token dan biaya tetap valid karena diputar ulang dari cache.
77. **Biaya.** Token terukur dikali `PRICE_INPUT_PER_M` dan `PRICE_OUTPUT_PER_M` dari lingkungan. Tanpa harga, biaya tertulis `n/a`. Tidak ada harga yang ditanam di kode.
78. **Item `perturbed`.** Setiap hasil memuat angka dengan semua item dan tanpa item `perturbed`, dan jumlahnya.

### Uji harness pada data templat (18 Nov 2026) bukan bukti

Seluruh alur dijalankan terhadap layanan nyata dan Gemini pada 12 baris templat (8 dev, 4 test): tuning, `cekkutip`, A1 sampai A4, B1 sampai B3, kappa, laporan. Angkanya **tidak boleh dikutip**. Empat referensi tidak berarti apa-apa secara statistik. Yang terbukti: semuanya berjalan, hasil bisa diulang persis, dan data templat tidak bisa masuk ke `eval/results`.

Satu pengamatan yang layak diperhatikan karena menyangkut aturan, bukan angka: **efek samping T1.** Referensi templat T003 adalah karya nyata dengan penulis yang seluruhnya diganti. Sebelum T1 hasilnya `mismatch_authors`. Sekarang `suspect_no_record_journal`, karena T1 menganggap "judul cocok tetapi tidak satu pun penulis ditemukan" sebagai karya lain. Keduanya masuk akal, tetapi ini pola yang umum pada referensi buatan asisten AI (judul asli, penulis keliru), dan label emas bergantung pada definisi: "mismatch = karya ada, detail keliru". Usul perbaikan (**T1', belum diterapkan**): T1 hanya berlaku untuk judul pendek atau umum (misalnya sampai 4 kata), tempat tabrakan judul memang terjadi (kasus WHO). Judul panjang yang khas dan cocok persis hampir pasti karya yang sama dengan penulis keliru, sehingga tetap `mismatch_authors`. Ini perubahan aturan, jadi menunggu keputusan pengguna, lalu diukur di dev set.

## 2026-11-18 (M6: aksesibilitas, performa, keamanan, Evaluation)

79. **`npm audit` (18 Nov 2026).** Dependensi produksi (`--omit=dev`): **0 kerentanan**. Seluruh pohon: 12 tinggi, semuanya alat build dan uji (`vite`, `vitest`, `@vitejs/plugin-react`, rantai `typescript-eslint`) lewat satu advisori: **GHSA-fc5q-39xc-vjpf, ReDoS di `picomatch` (rentang `<=4.0.7`)**. `4.0.7` adalah versi terbaru, jadi **belum ada versi tambalan** dan `overrides` tidak membantu. Saran `npm audit fix --force` menurunkan vite dan vitest ke versi lama dan tidak diikuti. Yang non-breaking (`minimatch`, 6 moderate) sudah diperbaiki dengan `npm audit fix`. Risiko yang tersisa: pola glob dari berkas konfigurasi kita sendiri, hanya saat build, tidak ikut ke image produksi. **Diterima, ditinjau ulang sebelum rilis akhir.** Brief meminta kerentanan tingkat tinggi diperbaiki: yang bisa diperbaiki sudah diperbaiki, sisanya tidak punya perbaikan.
80. **Halaman Evaluation membaca hasil nyata.** `eval/results/summary.json` dilayani lewat `GET /api/evaluation`. Ringkasan hanya ditampilkan bila **lengkap dan `sample: false`**. Validator buatan sendiri (`packages/shared/src/evaluation.ts`, tanpa pustaka skema di browser) menolak berkas yang tidak lengkap, angka yang bukan angka, dan ringkasan dari data templat. Semua yang tidak lolos menampilkan keadaan kosong yang jujur tanpa satu pun angka. Halaman hanya memformat angka dari berkas, tidak menghitung apa pun. Fixture tes (`@cekkutip/shared/testing`) berisi angka **karangan** dan hanya dipakai di tes.
81. **"Belum ada hasil" adalah jawaban 200** (`{"available": false}`), bukan 404. Sebuah 404 menaruh baris galat di konsol setiap pengunjung ("Failed to load resource"), dan itu menurunkan skor Best Practices.
82. **Kunjungan langsung ke `/evaluation` membawa keadaannya di dalam HTML** (blok `<script type="application/json">`, tanpa kode yang dijalankan, jadi lolos CSP ketat). Tanpa keadaan memuat, tanpa permintaan tambahan, dan tanpa halaman yang berubah bentuk setelah cat pertama. Pengukuran awal dengan `fetch` memberi CLS 0,256 dan LCP 2,7 detik pada pengaturan bawaan Lighthouse. Tanda `<` di dalam JSON di-escape supaya tidak ada isi berkas yang bisa menutup blok lebih awal (dibuktikan tes). Navigasi dari dalam aplikasi tetap memakai `fetch` (pergeseran sesudah klik tidak dihitung sebagai CLS).
83. **Pemecahan kode per halaman dihentikan.** Tiap halaman hanya beberapa KB, dan pemecahan membuat kunjungan langsung menunggu dua permintaan berurutan: LCP 0,8 detik menjadi sekitar 2,7 detik, dan footer melompat saat halaman tiba (CLS 0,203 di About). Semua halaman sekarang ikut paket utama. JS awal **105 KB gzip** (batas brief 200 KB). Ini menyimpang dari "pecah kode per halaman" di brief, karena tujuan di baliknya (performa) justru dirugikan.
84. **Kompresi teks** (`compression`) pada semua respons kecuali `/api/check`. Aliran hasil tidak boleh dikompres karena gzip menahan baris sampai buffer penuh, padahal hasil harus tiba satu per satu. Bobot halaman 487 KB menjadi 250 KB. Dibuktikan tes.
85. **`text-wrap: pretty` dihapus** dari paragraf (mahal untuk tata letak). **Dua font di atas lipatan dipramuat** (Newsreader 500 dan Plex Sans 400) lewat plugin Vite yang membaca nama berkas ber-hash dari bundel. Pada How it works, rata-rata skor bawaan naik dari 88 (85, 85, 95) menjadi 90 (88 sampai 92) walau CPU mesin lebih lambat saat pengukuran kedua.
86. **Tombol bahasa: "Label in Name" (WCAG 2.5.3).** Nama aksesibel sekarang diawali teks yang terlihat ("EN: Switch to English"). Sebelumnya Lighthouse menandainya.
87. **`robots.txt`** ditambahkan (izinkan semuanya kecuali `/api/`).
88. **Penyebab tes E2E yang acak:** klik "Try an example" kadang hilang karena font web selesai dimuat dan menggeser tombol di antara pengecekan stabil Playwright dan klik. Bukti: setelah tes menunggu `document.fonts.ready` dan `networkidle` di setiap `goto`, tiga putaran penuh berturut-turut lulus (sebelumnya satu sampai dua tes gagal tiap putaran). Pekerja Playwright dibatasi empat. Pergeseran ini tidak muncul di CLS Lighthouse (0).
89. **Ukuran data di halaman Evaluation** adalah jumlah per split (dev ditambah test), atau jalan "all" bila ada. Versi pertama memakai run terbesar saja dan menulis "80 referensi" untuk data yang sebenarnya 130.
90. **Tabel utama dipecah dua** (akurasi; waktu dan biaya) supaya muat di 1280 px tanpa digulir. Di bawah itu tabel menggulir di dalam kotaknya sendiri, dapat dijangkau keyboard (`role="region"`, `tabindex="0"`).

### Hasil Lighthouse (profil ponsel, 18 Nov 2026, build produksi, server lokal)

Perintah: `npm run e2e:server`, lalu `npm run lighthouse` (pengali CPU 1) dan `npm run lighthouse -- http://localhost:8799 --default` (pengaturan bawaan).

| Halaman      | Perf, pengali CPU 1 | Perf, bawaan | A11y | Best Practices | SEO |
| ------------ | ------------------- | ------------ | ---- | -------------- | --- |
| Check        | 100                 | 91           | 100  | 100            | 100 |
| How it works | 100                 | 82           | 100  | 100            | 100 |
| Evaluation   | 100                 | 87           | 100  | 100            | 100 |
| About        | 100                 | 96           | 100  | 100            | 100 |
| Privacy      | 100                 | 97           | 100  | 100            | 100 |

Semua halaman: FCP dan LCP 0,8 detik, CLS 0. Dengan pengali CPU 1, TBT 0 sampai 10 ms.

**Cara membaca angka ini dengan jujur:**

- Skor Performance dengan pengaturan bawaan **bergerak 5 sampai 10 poin antar-putaran** pada halaman yang sama (How it works: 95, 85, 85 sebelum pramuat font, dan 90, 91, 92, 88 sesudahnya). Satu tabel di atas adalah satu putaran, bukan rata-rata.
- `benchmarkIndex` mesin berubah antara 209 dan 1.278 menurut beban latar belakang (`npm audit fix` yang berjalan bersamaan sempat membuat pengukuran awal terlalu rendah). Pengukuran di atas dilakukan saat mesin lebih tenang (sekitar 560 sampai 1.250), tetapi tidak steril.
- **Yang tidak saya klaim:** bahwa pengaturan bawaan selalu menghasilkan 90 atau lebih di setiap halaman. Dua halaman (How it works dan Evaluation) berada di 82 sampai 92 menurut putaran. Penyumbang utamanya Total Blocking Time dari satu bundel React (sekitar 200 ms skrip di bawah throttling 4×, ditambah penataan gaya dan tata letak).
- **Tuas yang tersisa dan belum dipakai:** mengganti React dengan Preact (kompatibel, sekitar 100 KB lebih kecil). Itu mengubah tumpukan yang ditetapkan brief, jadi perlu persetujuan.
- Angka akhir diukur dengan **PageSpeed Insights pada URL deploy** (M7), karena itu yang akan dibandingkan juri.

## 2026-11-18 (M7: deploy)

91. **Host yang direkomendasikan: Render, web service gratis, region Singapore.** Terverifikasi dari dokumen resmi (18 Nov 2026): mendukung `runtime: docker`, plan gratis 0,1 CPU dan 512 MB, region `singapore` valid, 750 jam instance per bulan per workspace, tidur setelah 15 menit tanpa permintaan, bangun sekitar satu menit, sistem berkas hilang saat tidur. Cloud Run, Koyeb, Fly.io, dan Hugging Face Spaces dibandingkan di docs/DEPLOY.md dan tidak dipilih karena perlu kartu atau tidak terverifikasi. **Kelemahan utama: tidur dan bangun satu menit**, jadi demo ke juri butuh rencana (bangunkan lima menit sebelumnya, atau pemantau luar gratis, atau paket berbayar). Itu keputusan tim, dan paket berbayar menyentuh anggaran hampir nol.
92. **Server dibundel dengan esbuild** ke satu berkas (sekitar 78 KB): kode sendiri dan paket `shared` (yang berupa sumber TypeScript). Paket pihak ketiga **tidak** dibundel (pino dan SDK Google memakai require dinamis dan worker thread), melainkan dipasang di image dari `package-lock.json` dengan `npm ci --omit=dev`. Build gagal bila bundel mengimpor paket yang tidak tercantum di `dependencies` server. Bundel ditemani `package.json` berisi `{"type":"module"}`, karena tanpanya Node membaca berkas itu sebagai CommonJS.
93. **Image:** tiga tahap (build, dependensi produksi, runtime) di atas `node:22-alpine`, berjalan sebagai pengguna `node`, tanpa menulis ke disk, dengan `HEALTHCHECK` ke `/api/health`. 297 MB (47 MB dependensi produksi). `.dockerignore` menjaga `.env`, cache, dan tangkapan layar di luar image.
94. **Node 22 atau lebih baru** (`engines` dan README), bukan 20 seperti di brief. Skrip `dev` dan `start` memakai `--env-file-if-exists`, dan image memakai 22.
95. **Gerbang `TODO` berlaku di Docker.** `docker build` gagal selama `site.config.ts` berisi placeholder (dibuktikan 18 Nov). `--build-arg ALLOW_TODO=1` hanya untuk mencoba image secara lokal.
96. **`scripts/verify-production.ts`** memeriksa artefak produksi tanpa Docker: menyalin hanya isi image ke folder bersih, memasang dependensi produksi saja (dan memastikan alat pengembangan tidak ikut), menjalankan server dengan `NODE_ENV=production`, lalu memeriksa 18 hal lewat HTTP termasuk aliran hasil dan penolakan mode eksperimen. Pemeriksaan "fallback ke pembaca pola tanpa kunci" semula saya tulis kosong (selalu lulus) dan sudah diperbaiki menjadi pemeriksaan sungguhan.
97. **Penutupan server** menunggu permintaan berjalan lalu keluar paling lama sepuluh detik. Di Windows `SIGTERM` adalah penghentian paksa, jadi jalur halus hanya teruji secara logika, belum di Linux.
98. **`render.yaml`** memakai kunci yang saya cocokkan dengan referensi Blueprint hari itu (`runtime`, `plan`, `region`, `healthCheckPath`, `dockerfilePath`, `autoDeployTrigger`, `envVars` dengan `sync: false`). **Belum pernah dijalankan di Render.**

### Hasil uji image (18 Nov 2026, Docker Desktop lokal)

- Seluruh suite E2E (43 tes) lulus **dua kali terhadap kontainer** (CSP produksi aktif, pencarian dari cache rekaman).
- Daftar contoh dengan layanan nyata dan Gemini, **tiga kali berturut-turut** terhadap kontainer: **12,7 detik** (pencarian dingin), **3,1**, dan **2,2 detik**, verdict sama setiap kali (3 Verified, 2 Mismatch, 2 Suspect, 3 Out-of-index, 0 Could not check). Jauh di bawah 90 detik.
- Kontainer berjalan sebagai `node` dan berstatus `healthy`.

**Belum diuji, dan tidak bisa dari sini:** deploy ke Render, waktu bangun nyata di sana, PageSpeed Insights pada alamat publik, jalur penutupan di Linux, dan uji di perangkat nyata. Semuanya butuh akun host, alamat publik, atau perangkat.

## Ambang final

Belum dituning. Nilai sementara: `TAU_T` 0,90, `TAU_A` 0,60, `TAU_L` 0,60, `TAU_V` 0,40. Diisi setelah `npm run eval:tune` pada dev set (M5): ambang, hash commit, tanggal.
