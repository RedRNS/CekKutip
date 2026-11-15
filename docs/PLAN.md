# CekKutip: Rencana Pembangunan (PLAN.md)

Status: **menunggu persetujuan**. Belum ada kode yang ditulis. Tanggal rencana: 16 November 2026. Tenggat versi online: 29 November 2026 (13 hari).

## 1. Ringkasan satu paragraf

CekKutip adalah satu layanan Node (Express) yang menyajikan API dan berkas statis klien React. Pengguna menempelkan daftar pustaka. Server memecahnya (deterministik), meminta Gemini mengekstrak field (satu-satunya pemakaian model), mencari di Crossref lalu OpenAlex, membandingkan field, lalu fungsi murni `decide` menetapkan verdict. Hasil dialirkan per referensi lewat NDJSON. Harness evaluasi di `eval/` memakai kode pipeline yang sama dengan konfigurasi berbeda, jadi baseline dan ablation tidak menduplikasi kode.

## 2. Hasil pemeriksaan dokumentasi (16 Nov 2026)

| Hal                                | Temuan                                                                                                                                                                                                                                                                                               | Dampak                                                                                                                                                      |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Model Gemini                       | `gemini-3.1-flash-lite` berstatus **stable** (halaman model Google AI Studio). ID `-preview` lama sudah dijadwalkan mati. Mendukung structured output.                                                                                                                                               | Default `GEMINI_MODEL=gemini-3.1-flash-lite`. Dicatat di DECISIONS.md.                                                                                      |
| Parameter skema                    | Halaman model memakai `response_mime_type` dan `response_json_schema`, bukan selalu `responseSchema` seperti di brief.                                                                                                                                                                               | Diverifikasi terhadap `@google/genai` terbaru saat menulis `clients/gemini.ts` (M3).                                                                        |
| Harga dan kuota tier gratis Gemini | Tidak terbaca dari halaman model.                                                                                                                                                                                                                                                                    | Harga dibaca dari `PRICE_INPUT_PER_M` dan `PRICE_OUTPUT_PER_M`. Kuota dicek di halaman pricing sebelum eval (M5).                                           |
| OpenAlex                           | Kunci opsional. Kunci gratis memberi anggaran harian 10 kali lipat. Dikirim sebagai `api_key` (query) atau `Authorization: Bearer`. Batas 10 req/detik tanpa kunci, 30 dengan kunci. Email kunci harus diverifikasi (kalau belum: 403 `key_not_activated`). Halaman bantuan tidak menyebut `mailto`. | Kunci dikirim lewat header Bearer (tidak bocor ke log URL). Klien memperlakukan 403 `key_not_activated` sebagai `check_failed`, bukan verdict.              |
| Crossref                           | `mailto` memberi akses polite pool. Halaman swagger tidak memuat angka batas. Angka di brief (10/detik untuk satu record, 3/detik untuk daftar) belum terverifikasi dari sumber resmi.                                                                                                               | Konkurensi 4 plus pembatas laju di klien. Baca header `x-rate-limit-*` dari respons dan sesuaikan otomatis. Verifikasi angka di halaman etiket resmi di M2. |
| `@google/genai` di npm             | Halaman npm diblokir (403) dari alat ini.                                                                                                                                                                                                                                                            | Versi diambil lewat `npm view` saat instalasi.                                                                                                              |

Hal yang masih harus dibaca sebelum menulis klien (sesuai aturan kerja no. 4): DataCite REST API (P1), `doi.org/doiRA`, dan halaman Searching OpenAlex (parameter `filter=title.search:` vs `search=`).

## 3. Arsitektur

```
Browser (React)                          Server (Express, satu proses)                    Layanan luar
-----------------                        --------------------------------                 --------------
ReferenceInput --POST /api/check-------> zod validate -> rate limit -> run.ts
   ^                                          |
   | NDJSON: started, result*, done           v
ResultsLedger <---------------------   split.ts (murni)
                                              v
                                        parse.ts --batch 8-----------------------------> Gemini (atau regex)
                                              v
                                        retrieve.ts (konkurensi 4, cache LRU 24 jam)
                                          DOI:  Crossref /works/{doi} -> 404 -> doi.org/doiRA -> DataCite (P1)
                                          Tanpa DOI: Crossref query.bibliographic -> cadangan OpenAlex
                                              v
                                        match.ts (murni) -> 4 skor per kandidat
                                              v
                                        decide.ts (murni) -> verdict + kode alasan
                                              v
                                        format.ts (templat teks per kode alasan; tanpa model)
```

Prinsip implementasi:

- **Pipeline dengan injeksi.** `runPipeline(input, { config, clients, cache })`. `config` memuat sistem (`cekkutip`, `b1`, `b2`, `b3`), ablation (`a1` sampai `a4`), parse mode, ambang. Klien HTTP dan Gemini diberikan dari luar, sehingga tes memakai fixture dan harness memakai cache rekam-ulang.
- **Fungsi murni:** `split`, `normalize`, `similarity`, `match`, `decide`, `format`. Klien terisolasi: `crossref`, `openalex`, `datacite`, `doi`, `gemini`.
- **Kegagalan layanan tidak pernah menjadi verdict.** Semua klien melempar galat bertipe (`ServiceUnavailable`). `run.ts` menangkapnya per referensi menjadi `check_failed`.
- **Streaming:** `POST /api/check` membalas `application/x-ndjson`. Alasan memilih NDJSON dibanding SSE: SSE bawaan browser hanya GET, sedangkan teks pengguna tidak boleh masuk URL. Klien membaca dengan `fetch` + `ReadableStream`. Kejadian: `started`, `result` (tidak berurutan), `done`.
- **Penyajian:** Express menyajikan `apps/web/dist` dengan fallback SPA untuk React Router. Satu Dockerfile multi-stage.
- **Keamanan:** helmet dengan CSP ketat. Konsekuensi desain: tidak ada atribut `style` inline di React (CSP `style-src 'self'`). SummaryBar dibuat sebagai SVG dengan atribut lebar, bukan `style="width:..%"`. Host keluar diizinkan lewat daftar putih di `lib/http.ts` (`api.crossref.org`, `api.openalex.org`, `api.datacite.org`, `doi.org`).
- **Privasi:** logger pino punya serializer yang hanya meloloskan `reqId`, `count`, `latencyMs`, `errorCode`. Tes mengecek keluaran log setelah permintaan berisi teks khas dan memastikan teks itu tidak ada.
- **Eval:** `eval/scripts/*.ts` memanggil `runPipeline` langsung (tanpa HTTP), dengan klien yang dibungkus cache berkas (`RETRIEVAL_CACHE_DIR`, mode record dan replay). Label emas tidak pernah masuk ke fungsi pipeline (tipe masukan tidak memuatnya).

## 4. Struktur repo

Akar repo adalah folder kerja saat ini (`d:\Projects\CekKutip - IYSA`), bukan subfolder `cekkutip/` seperti di sketsa brief. Isinya sama dengan bagian 5 brief. Tambahan yang saya usulkan:

- `tsconfig.base.json` (strict), `eslint.config.js`, `.prettierrc`, `.gitignore`, `.nvmrc`.
- `apps/server/test/fixtures/` untuk respons API terekam. `apps/server/test/` untuk Vitest.
- `apps/web/e2e/` untuk Playwright dan tes axe.
- `scripts/` untuk skrip tangkapan layar (`screenshots.ts`) dan pemeriksa placeholder `TODO`.

## 5. Tahap kerja

Setiap tahap ditutup dengan: tes lulus, build bersih, tangkapan layar diperiksa (untuk UI), commit sendiri. Tanggal mengikuti brief.

| Tahap | Target | Isi                                                                                                               | Catatan risiko                                                                                                                                                                       |
| ----- | ------ | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| M0    | 16 Nov | `git init`, workspace, TS ketat, ESLint, Vitest, `CLAUDE.md`, `docs/DECISIONS.md` awal                            | Node lokal v26.13 sedangkan target `>=20`. `engines` dan Docker memakai LTS. CI lokal menjalankan tes pada versi lokal saja.                                                         |
| M1    | 18 Nov | Token CSS, font `@fontsource`, header, footer, i18n EN/ID, halaman statis, glif verdict SVG, diagram pipeline SVG | Waktu desain paling mahal. Halaman Evaluation dan About berupa keadaan kosong jujur.                                                                                                 |
| M2    | 20 Nov | `split`, `normalize`, `similarity`, klien Crossref dan OpenAlex, cache LRU, retry dan backoff, pembatas laju      | Rekam fixture 200, 404, 429, 5xx, timeout.                                                                                                                                           |
| M3    | 22 Nov | Parse Gemini dan regex, `match`, `decide` (tes tabel), `format`, `/api/check` NDJSON, helmet, rate limit          | Tuning ambang belum dilakukan (nilai awal 0,90/0,60/0,60).                                                                                                                           |
| M4    | 24 Nov | Workbench, ledger, panel bukti, SummaryBar, filter, ekspor CSV, salin laporan, daftar contoh, E2E alur contoh     | Daftar contoh perlu dijalankan lewat pipeline asli dan dicatat hasilnya.                                                                                                             |
| M5    | 26 Nov | Harness eval: sistem B1 sampai B3, ablation A1 sampai A4, `tune`, `kappa`, `report`                               | Dataset 130 referensi diisi tim. Saya sediakan `references.template.csv` dan menguji harness dengan data contoh kecil. **Data contoh itu tidak boleh muncul di halaman Evaluation.** |
| M6    | 28 Nov | axe pada semua halaman, Lighthouse, `npm audit`, privasi, halaman Evaluation membaca `summary.json`               | Target Lighthouse Performance 90 di ponsel perlu dicek di build produksi.                                                                                                            |
| M7    | 29 Nov | Dockerfile, DEPLOY.md, README, deploy, uji di perangkat nyata                                                     | Lihat risiko host di bawah.                                                                                                                                                          |

P1 dikerjakan setelah M6 bila P0 rapi. Urutan P1 yang saya usulkan: DataCite, pratinjau pemisahan, unggah `.txt` dan `.bib`, format ulang APA 7, print stylesheet. P2 tidak direncanakan.

## 6. Asumsi dan keputusan yang saya ambil (akan masuk DECISIONS.md)

1. **Akar repo = folder kerja ini.** Nama paket npm `cekkutip`.
2. **Model default** `gemini-3.1-flash-lite` (stable, terverifikasi 16 Nov 2026).
3. **NDJSON, bukan SSE** (alasan di atas).
4. **Tanpa pustaka state global dan tanpa pustaka UI.** React state dan reducer sudah cukup. Dependensi klien: `react`, `react-router-dom`, `lucide-react` (ikon utilitas), `@fontsource/*`. Pecah kode per halaman dengan `React.lazy`.
5. **i18n buatan sendiri:** kamus bertipe `en.ts` dan `id.ts`, kunci dicek oleh TypeScript supaya tidak ada teks yang hilang di salah satu bahasa.
6. **Perhitungan kontras:** semua token warna dari brief dipakai apa adanya. Saya jalankan skrip kecil untuk memverifikasi rasio kontras sebelum M1 selesai, dan mencatat hasilnya di DESIGN.md.
7. **Jarak Levenshtein** ditulis sendiri (tanpa dependensi). Normalisasi: NFKD, hapus diakritik, huruf kecil, hapus tanda baca, rapikan spasi.
8. **Rate limit server** 10 pemeriksaan per 10 menit per IP (dapat diatur). Di balik proxy host, `trust proxy` diaktifkan agar IP benar.

## 7. Celah dan ambiguitas pada aturan Decide (6.5) yang perlu keputusanmu

Saya tidak mengubah aturan. Tetapi tabel di brief punya dua celah yang akan muncul di tes tabel, dan saya perlu cara menutupnya. Usulan saya di bawah akan saya terapkan kecuali kamu menolak.

**Celah A: `mismatch_venue` tidak bisa muncul sendirian.**
Baris 4 menjadi `verified` bila judul, penulis, dan tahun cocok, tanpa melihat venue. Maka baris 5 dengan alasan `mismatch_venue` hanya muncul bersama alasan lain. Padahal contoh di bagian 9.4 dan teks `mismatch_venue` menunjukkan venue yang berbeda sebagai sebab mismatch sendiri.
Usulan: baris 4 mensyaratkan juga bahwa venue **tidak jelas berbeda**, yaitu venue dikutip dan ditemukan, dan skor venue di bawah ambang `TAU_V` (nilai awal 0,40). Bila venue tidak dikutip atau tidak ada di record, tidak dihitung berbeda. Jika jelas berbeda, jatuh ke baris 5. `TAU_V` ditambahkan ke `thresholds.ts` dan ikut dituning pada dev set.

**Celah B: record dari DOI dengan skor judul di antara `TAU_L` dan `TAU_T`.**
Baris 3 hanya menangani skor di bawah `TAU_L`, baris 4 dan 5 menuntut skor di atas `TAU_T`, dan baris 6 hanya berlaku bila _tidak ada_ kandidat di atas `TAU_L`. Referensi ber-DOI yang judulnya agak berbeda (misalnya subjudul terpotong) jatuh ke celah.
Usulan: record yang diambil lewat DOI diperlakukan sebagai kandidat yang pasti ada. Bila skor judulnya di antara `TAU_L` dan `TAU_T`, perlakukan seolah-olah melewati `TAU_T` untuk keperluan baris 4 dan 5 (jadi `verified` bila penulis dan tahun cocok, selain itu `mismatch` dengan alasan field yang berbeda). Alasannya: DOI adalah pengenal eksak, dan hanya skor di bawah `TAU_L` yang menandakan karya lain.

**Satu catatan lagi:** brief meminta `temperature` 0 untuk Parse. Pengalaman saya dengan keluarga Gemini 3 adalah Google menganjurkan temperatur bawaan (1.0) karena nilai rendah bisa membuat pengulangan. Ini belum terverifikasi. Akan saya cek di dokumentasi saat M3. Jika benar, saya tetap memakai structured output plus validasi zod dan mencatat penyimpangan itu di DECISIONS.md.

## 8. Risiko

| Risiko                                                           | Kemungkinan | Dampak             | Mitigasi                                                                                                                                                                                                                     |
| ---------------------------------------------------------------- | ----------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Host gratis tidur (cold start) saat demo juri                    | Tinggi      | Tinggi             | Pilih host di M7 setelah membaca ketentuan terkini. Sediakan `/api/health`. Sebelum demo, panggil health beberapa menit sebelumnya (atau pasang pemantau gratis). Alternatif cadangan: jalankan Docker lokal dan rekam demo. |
| Kuota tier gratis Gemini habis atau dibatasi saat eval atau demo | Sedang      | Tinggi             | Mode tanpa AI (regex) selalu tersedia. Eval memakai cache. Pesan galat jelas bila Gemini gagal, lalu fallback regex per referensi.                                                                                           |
| Crossref lambat atau 429                                         | Sedang      | Sedang             | Cache, backoff, hormati `Retry-After`, hasil `check_failed` yang jujur dengan tombol Try again.                                                                                                                              |
| Dataset evaluasi belum cukup sebelum 9 Des                       | Sedang      | Tinggi untuk paper | Harness selesai dan teruji di M5, supaya tim hanya mengisi CSV. Template memuat panduan pelabelan.                                                                                                                           |
| Waktu desain (M1) memakan jadwal                                 | Sedang      | Sedang             | Token dan komponen kecil dibuat dulu. Halaman statis memakai komponen yang sama.                                                                                                                                             |
| Lighthouse Performance di ponsel di bawah 90                     | Rendah      | Rendah             | Subset font, code splitting, tanpa pustaka berat.                                                                                                                                                                            |
| Pustaka rilis baru memutus API (`@google/genai`, Playwright)     | Rendah      | Sedang             | Kunci versi di `package-lock.json`.                                                                                                                                                                                          |
| Referensi contoh tidak menghasilkan verdict yang diharapkan      | Sedang      | Rendah             | Ganti entri, jangan ubah aturan (brief bagian 13 dan 16).                                                                                                                                                                    |

## 9. Yang tidak bisa saya putuskan atau isi sendiri

1. **Alamat email untuk `CROSSREF_MAILTO`.** Alamat ini dikirim ke Crossref pada setiap permintaan. Saya tidak akan memakai email akunmu tanpa persetujuan. Email mana yang dipakai (misalnya email tim)?
2. **Kunci API Gemini** (`GEMINI_API_KEY`) dan kunci OpenAlex (opsional, gratis). Hanya masuk `.env` lokal dan variabel host, tidak pernah ke repo.
3. **Pilihan host.** Default saya: tentukan di M7 setelah memeriksa ketentuan host gratis terkini. Beri tahu bila tim sudah punya akun di host tertentu.
4. **Isi `site.config.ts`** (nama tim, anggota, pembimbing, kontak, tautan). Saya isi placeholder `TODO`. Build produksi gagal selama masih ada.
5. **Dataset evaluasi** (130 referensi, 80 dev dan 50 test, dua pelabel) dan **daftar demo final**.

## 10. Yang saya butuhkan darimu sekarang

- Persetujuan rencana ini, termasuk usulan penutup untuk **Celah A** dan **Celah B**. Jika menolak, beri tahu aturan pengganti.
- Jawaban singkat untuk email `CROSSREF_MAILTO` (butir 9.1). Jika belum ada, saya lanjut dengan placeholder di `.env.example` dan tes berjalan dengan fixture.

Setelah disetujui saya mengerjakan M0 dan M1, lalu lanjut tanpa bertanya hal kecil.
