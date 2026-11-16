# CekKutip: panduan untuk sesi Claude

CekKutip memeriksa daftar pustaka mahasiswa Indonesia. Pengguna menempelkan referensi. Server mencari tiap referensi di Crossref dan OpenAlex, lalu memberi satu verdict: `Verified`, `Mismatch`, `Suspect`, atau `Out-of-index`. Untuk lomba GYIIF 2027. Tenggat versi online: 29 November 2026. Rencana lengkap: `docs/PLAN.md`. Keputusan teknis: `docs/DECISIONS.md`.

## Prinsip produk (tidak boleh dilanggar)

1. **Model bahasa tidak pernah memutuskan verdict, memilih kandidat, atau menulis penjelasan.** Gemini hanya mengekstrak field di tahap Parse. Verdict datang dari `decide()` (fungsi murni). Teks penjelasan dari templat per kode alasan.
2. **Abstain itu fitur.** Bukti kurang menghasilkan `out_of_index` atau `check_failed`. Layanan yang gagal **tidak pernah** menjadi `suspect`.
3. **Verdict adalah ajakan memeriksa, bukan tuduhan.** Dilarang di UI: fake, fraud, plagiarism, cheating, liar. Pakai: could not be found, does not match, cannot be checked.
4. **Tidak ada angka karangan.** Tidak ada akurasi, jumlah pengguna, testimoni, atau logo mitra. Halaman Evaluation kosong sampai ada `eval/results/summary.json` dari harness sungguhan.
5. **Privasi:** teks pengguna tidak disimpan dan tidak masuk log (bukti: tes). Pengguna boleh memilih mode tanpa AI (parser regex).
6. **Jelas lebih penting daripada mengesankan.** Setiap layar menjawab: apa yang bisa kulakukan, apa hasilnya, apa langkah berikutnya.

## Larangan

- Jangan mengubah aturan keputusan atau ambang agar hasil terlihat bagus. Ambang dituning **hanya di dev set**, lalu dibekukan di DECISIONS.md dengan hash commit.
- Jangan menambah fitur di luar daftar, layanan berbayar, atau rahasia di klien atau repo. `.env` tidak di-commit.
- Jangan klaim CekKutip yang pertama atau satu-satunya.
- UI: tanpa emoji, gradien, blur kaca, ilustrasi stok, tombol pil, bayangan dekoratif, Tailwind, atau pustaka komponen. Kata terlarang di teks: supercharge, seamless, unlock, revolutionize, magic, powerful, cutting-edge, "Welcome to".
- Jangan menulis teks referensi pengguna ke log.
- Host keluar hanya: `api.crossref.org`, `api.openalex.org`, `api.datacite.org`, `doi.org`.

## Perintah

```
npm install
npm test               # vitest, semua workspace
npm run typecheck
npm run lint
npm run build
npm run dev               # server API di :8787 (tsx watch, membaca .env)
npm run dev:web           # Vite di :5173, /api diteruskan ke :8787
npx tsx scripts/smoke-check.ts   # kirim 12 referensi ke server yang sedang jalan, cetak verdict
npx tsx --env-file=.env scripts/smoke-gemini.ts   # uji tahap Parse terhadap Gemini nyata
npm run test:e2e          # Playwright, server putar-ulang tanpa jaringan (membangun web dulu)
npm run e2e:server        # server putar-ulang di :8799 (untuk tangkapan layar)
npm run screenshots       # tangkapan layar 375/768/1280 + axe (butuh e2e:server); argumen: baseUrl en|id
npx tsx scripts/check-examples.ts <baseUrl> llm|regex   # verdict daftar contoh
npm run smoke:live        # klien nyata terhadap Crossref, OpenAlex, doi.org (membaca .env)
npm run fixtures:record   # rekam ulang fixture tes dari layanan nyata
npm run eval -- --split test --system cekkutip --out eval/results   # M5
npm run eval:tune | eval:kappa | eval:report                         # M5
```

Catatan alat: di alat Bash, heredoc besar berisi kutip bisa gagal diparse, jadi untuk berkas panjang pakai alat Write. Di Write dan Bash, escape Unicode (garis miring terbalik, huruf u, empat digit heksadesimal) diubah menjadi karakter aslinya sebelum sampai ke berkas, dan karakter tak terlihat lolos ke kode sumber. Untuk escape semacam itu di kode, bangun lewat skrip yang memakai `String.fromCharCode(92)`, lalu pastikan tidak ada karakter tak terlihat yang tersisa di sumber (ESLint `no-irregular-whitespace` menangkapnya).

`CROSSREF_MAILTO` ada di `.env` lokal (diabaikan git). Jangan menaruh alamat itu di perintah, URL, atau berkas yang di-commit. Probe langsung ke layanan dilakukan tanpa alamat itu (pool publik), kecuali pengguna menjalankannya sendiri (`npm run smoke:live`).

## Struktur

- `packages/shared`: skema zod dan tipe (dipakai server dan klien).
- `apps/server`: Express + pipeline (`split`, `parse`, `retrieve`, `match`, `decide`, `format`, `run`), klien API, konfigurasi (`config/thresholds.ts`, `config/limits.ts`).
- `apps/web`: Vite + React + CSS biasa. Token di `styles/tokens.css`. i18n buatan sendiri di `i18n/`.
- `eval/`: harness evaluasi memanggil `runPipeline` langsung dengan konfigurasi sistem dan ablation.

## Pipeline

split, Parse (satu-satunya yang memakai model), Retrieve, Match, Decide. Streaming NDJSON: `started`, `result` (tidak berurutan), `done`. Aturan Decide: tabel 6.5 brief, dengan dua penutup celah yang disetujui:

- **Celah A:** baris 4 (`verified`) juga mensyaratkan venue tidak jelas berbeda (venue dikutip dan ditemukan, skor `< TAU_V` berarti berbeda). Jika berbeda, jatuh ke baris 5 (`mismatch_venue`).
- **Celah B:** record yang diambil lewat DOI dengan skor judul di antara `TAU_L` dan `TAU_T` diperlakukan seolah melewati `TAU_T` untuk baris 4 dan 5.

Tiga penyempurnaan yang disetujui pengguna pada 16 Nov 2026 (DECISIONS butir 55 sampai 57):

- **T1:** kandidat pencarian berjudul cocok tetapi tanpa satu pun penulis yang dikutip adalah karya lain, bukan `mismatch`.
- **T2:** bila Crossref punya judul yang cocok tetapi hasilnya bukan `verified`, cari juga di OpenAlex dan pakai hasilnya hanya bila `verified`.
- **T3:** venue pada skripsi, buku, bab buku, laporan, dan halaman web bukan "nama jurnal" untuk baris 6.

Juga: `verified` butuh minimal dua dari judul, penulis, tahun yang tertulis (butir 35).

## Token desain (ringkas; lengkap di docs/DESIGN.md)

Warna netral: paper `#F6F8F7`, surface `#FFFFFF`, ink `#12232E`, ink-muted `#4B5B66`, rule `#C9D4D1`, rule-strong `#6B7C78`, brand `#12343B`, accent `#0B6B63`, accent-tint `#E3F0EE`.

Verdict (solid / ink / tint): Verified `#2E7D32` `#1E6B2A` `#E7F3E8`; Mismatch `#C27D0E` `#8A5300` `#FBF0DC` (solid hanya untuk grafis); Suspect `#C0392B` `#A32A1E` `#F9E4E1`; Out-of-index `#5F6B7A` `#465160` `#E9ECEF`.

Font (self-host `@fontsource`, subset Latin): Newsreader (judul), IBM Plex Sans (UI), IBM Plex Mono (DOI, kode). Radius 2 px kontrol, 4 px panel. Jarak: 4, 8, 12, 16, 24, 32, 48, 72. Lebar maksimum 1180 px. Verdict harus terbaca tanpa warna: bentuk glif, pola bilah, dan teks.

## Alur kerja per tahap

Tes lulus, build bersih, tangkapan layar 375/768/1280 diperiksa (untuk UI), daftar periksa 9.9 dijawab ya, lalu commit tersendiri. Periksa dokumentasi terbaru sebelum menulis klien Gemini, Crossref, OpenAlex, DataCite.
