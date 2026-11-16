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

### Masalah terbuka pada aturan (menunggu keputusan pengguna, aturan belum diubah)

Ketiganya muncul dari uji langsung dan sama-sama menghasilkan tuduhan keliru pada referensi yang benar. Aturan tidak diubah berdasarkan contoh. Seharusnya diputuskan pengguna dan diukur di dev set.

- **T1, record lain berjudul sama.** `World Health Organization. (2021). Obesity and overweight. https://www.who.int/...` (halaman web yang benar) mendapat `mismatch_authors` + `mismatch_year`, karena Crossref punya artikel lain berjudul persis "Obesity and overweight". Judul pendek dan umum akan sering bertabrakan. Usul: bila judul cocok tetapi **tidak satu pun** penulis yang dikutip ditemukan (skor penulis 0), anggap itu karya lain, bukan karya yang sama dengan penulis keliru. Referensi lalu jatuh ke baris 6 atau 7 sesuai tipe. `mismatch_authors` tetap berlaku untuk kecocokan sebagian.
- **T2, Crossref hanya memuat unggahan ulang.** `Vaswani et al. (2017). Attention is all you need` mendapat `mismatch_year` (selisih 8 tahun) karena Crossref hanya punya unggahan ulang tahun 2025. Usul: bila kandidat terbaik Crossref `mismatch`, cari juga di OpenAlex dan pakai kandidat yang cocok penuh bila ada.
- **T3, venue pada tipe non-jurnal.** Baris 6 menganggap referensi "seperti jurnal" bila ada venue, termasuk bila tipenya skripsi, buku, laporan, atau halaman web. Butir 52 mengurangi kasusnya di Parse, tetapi parser regex dan model masih bisa mengisi venue. Usul: untuk tipe-tipe itu venue tidak dihitung sebagai "nama jurnal" (volume dan DOI tetap dihitung).

### Latensi dan risiko demo

- Dengan Gemini dan cache kosong, 12 referensi butuh 32 sampai 45 detik di pool publik Crossref (satu permintaan sekaligus, dan saat diuji tiap pencarian butuh 4 sampai 5 detik). Mode tanpa AI pada saat lain butuh sekitar 10 detik untuk daftar yang sama. Kecepatan Crossref berubah-ubah.
- Dengan hasil pencarian sudah di cache, daftar yang sama selesai dalam 5,4 detik (waktu model saja).
- **Belum diukur: pool polite** (dengan `CROSSREF_MAILTO`, tiga permintaan sekaligus). Saya tidak menjalankan server dengan alamat itu. Pengguna bisa mengukurnya dengan `npm run dev` lalu `npx tsx scripts/smoke-check.ts http://localhost:8787 llm`.
- Untuk demo ke juri: jalankan daftar demo sekali sebelum presentasi agar hasil pencarian ada di cache 24 jam. Ini dicatat di DEPLOY.md (M7).

## Ambang final

Belum dituning. Nilai sementara: `TAU_T` 0,90, `TAU_A` 0,60, `TAU_L` 0,60, `TAU_V` 0,40. Diisi setelah `npm run eval:tune` pada dev set (M5): ambang, hash commit, tanggal.
