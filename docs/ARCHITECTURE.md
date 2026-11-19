# Arsitektur CekKutip

Satu layanan Node (Express) melayani API dan aplikasi web hasil build. Pengguna menempelkan daftar pustaka. Server memecahnya, meminta model bahasa membaca field-nya, mencari tiap karya di Crossref dan OpenAlex, membandingkan, lalu memutuskan verdict dengan aturan tetap. Model bahasa tidak pernah memutuskan verdict.

## Aliran data

```
Browser (React)                       Server (Express, satu proses)                     Layanan luar
---------------                       -----------------------------                     ------------
ReferenceInput
  splitReferences (shared) ----+
  "N found"                    |
                               v
Check --POST /api/check---> zod validate -> rate limit -> prepareReferences (batas jumlah dan panjang)
                                   |
   NDJSON: started, result*, done  v
ResultsLedger <-------------- runPipeline
                                   |   batch seimbang, sampai 3 batch sekaligus
                                   v
                              PARSE  parseBatch -----------------------------------> Gemini (atau parser regex)
                                   |   validateExtraction: zod + "tertulis di teks"
                                   v
                              RETRIEVE  concurrency 3, cache LRU 24 jam
                                   |   DOI:  Crossref /works/{doi}
                                   |           404 -> doi.org/doiRA -> tidak terdaftar | DataCite -> api.datacite.org | registri lain
                                   |   tanpa DOI: Crossref bibliographic ---------------> Crossref
                                   |           bila tidak ada kandidat >= TAU_L -> OpenAlex  -> OpenAlex
                                   v
                              MATCH  skor judul, penulis, tahun, venue; kandidat terbaik
                                   |
                                   v
                              DECIDE  fungsi murni, tabel 6.5 + T1/T2/T3 + aturan bukti
                                   |   (T2: pandangan kedua ke OpenAlex)
                                   v
                              buildComparison -> ReferenceResult (kode alasan, bukan prosa)
```

Teks penjelasan untuk pengguna dibuat di klien dari templat per kode alasan (`i18n/`), bukan oleh model.

## Tahap

| Tahap    | Berkas                                                                                        | Isi                                                                                                                                                                                                                     |
| -------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Split    | `packages/shared/src/split.ts`                                                                | Deterministik, dipakai browser dan server supaya "N found" sama dengan yang diperiksa. Memisah pada baris kosong, nomor, atau pola penulis. Batas jumlah dan panjang ditolak, tidak dipotong.                           |
| Parse    | `pipeline/parse.ts`, `clients/gemini.ts`, `pipeline/regex-parse.ts`                           | Satu-satunya tahap yang memakai model. Keluaran divalidasi dengan zod **dan** harus benar-benar tertulis di teks referensi. Gagal: ulang sekali sebagai panggilan tunggal, lalu parser regex.                           |
| Retrieve | `pipeline/retrieve.ts`, `clients/*.ts` (Crossref, OpenAlex, DataCite, doi.org), `lib/http.ts` | Klien HTTP dengan timeout 8 detik, retry, `Retry-After`, daftar putih host, dan penjadwal laju per layanan yang mengikuti batas yang diiklankan Crossref. Kegagalan layanan dilempar sebagai `ServiceUnavailableError`. |
| Match    | `pipeline/match.ts`, `lib/similarity.ts`                                                      | Levenshtein ternormalisasi, subjudul, nama keluarga (tahan `et al.`, inisial, satu nama), singkatan venue.                                                                                                              |
| Decide   | `pipeline/decide.ts`                                                                          | Fungsi murni. Diuji pada setiap baris tabel keputusan.                                                                                                                                                                  |
| Format   | `pipeline/format.ts`                                                                          | Perbandingan field untuk panel bukti.                                                                                                                                                                                   |
| Run      | `pipeline/run.ts`                                                                             | Orkestrasi, aliran hasil per referensi, ringkasan.                                                                                                                                                                      |

## Prinsip yang ditegakkan di kode

- **Kegagalan layanan bukan verdict.** Semua klien melempar galat bertipe. `checkOne` menangkapnya dan memberi `check_failed`. Galat tak terduga juga `check_failed`.
- **Abstain adalah fitur.** `out_of_index` untuk tipe sumber yang sering tidak terindeks, data terlalu sedikit, atau DOI di registri lain.
- **Model hanya membaca.** Keluaran model yang memuat DOI, judul, venue, penulis, atau tahun yang tidak tertulis di teks ditolak. Field tambahan seperti "verdict" dibuang oleh skema.
- **Privasi.** `AppLogger` hanya punya metode bertipe tetap (id, jumlah, waktu, kode), jadi teks pengguna tidak bisa masuk log. Cache hanya memuat metadata publik dengan kunci berupa hash. Server tidak menyimpan teks. Dibuktikan tes.
- **Host keluar** hanya `api.crossref.org`, `api.openalex.org`, `api.datacite.org`, `doi.org`, juga pada setiap redirect.

## Kunci Gemini milik pengguna dan ekstensi

```
Situs (localStorage)  <--postMessage-->  bridge.js (skrip konten, hanya di halaman CekKutip)  <--->  chrome.storage.local  <--->  Popup
         |                                                                                                              |
         +----------------- POST /api/check, header x-gemini-key (hanya bila pembaca AI dipakai) ---------------------------+
                                                         |
                                                  server: klien Gemini untuk permintaan itu saja; tidak disimpan, tidak masuk log
```

Aturan dan protokol di `packages/shared/src/apikey.ts`. Perubahan terakhir menang; penghapusan tercatat dengan waktu. Ringkasan `done` membawa `aiIssue` (`rejected` atau `quota`) bila model tidak bisa dipakai. Folder `extension/` (di luar workspace npm) membangun popup dengan komponen yang sama dengan situs. Lihat `extension/README.md` dan DECISIONS butir 112 sampai 119.

## Server

| Rute                  | Fungsi                                                                                                                             |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/check`     | Aliran NDJSON (`started`, `result` tidak berurutan, `done`). Batas badan 64 KB, batas laju per IP.                                 |
| `GET /api/health`     | Status dan versi. Dipakai pemeriksa kesehatan host.                                                                                |
| `GET /api/config`     | Batas publik, versi, dan `aiAvailable`.                                                                                            |
| `GET /api/evaluation` | Ringkasan evaluasi bila lengkap dan nyata, selain itu `{"available": false}` (200).                                                |
| `GET /evaluation`     | Halaman ini membawa keadaan evaluasi di dalam HTML (blok data JSON), supaya kunjungan langsung tidak bergeser setelah cat pertama. |
| Selebihnya            | Aplikasi web statis. `/assets` di-cache setahun, halaman `no-cache`, teks dikompres kecuali aliran hasil.                          |

Keamanan: helmet dengan CSP ketat (hanya same-origin, tanpa skrip atau gaya inline), tanpa CORS, validasi zod, mode eksperimen mati di produksi, kunci hanya di server.

## Klien

React dengan CSS biasa dan token di `styles/tokens.css`. State pemeriksaan adalah `useReducer` (`state/check.ts`) yang diisi oleh pembaca aliran (`lib/api.ts`). Teks antarmuka dua bahasa ada di `i18n/`, tipe `Dict` memastikan kunci Inggris dan Indonesia selalu sama. Halaman diikutkan di paket utama, bukan dipecah (DECISIONS no. 83).

## Evaluasi

`eval/` memanggil `runPipeline` langsung, dengan konfigurasi sistem dan ablation. Pencarian dan jawaban model disimpan di cache berkas sehingga jalan ulang `--replay-only` memberi hasil yang identik. Tuning ambang hanya di dev set. Hasil dari data templat tidak bisa masuk ke `eval/results`. Lihat `eval/README.md`.

## Build dan image

`npm run build` membangun aplikasi web (Vite) lalu membundel server dengan esbuild ke `dist/server/index.js` (kode sendiri dan paket `shared`, sekitar 78 KB). Paket pihak ketiga tetap eksternal dan dipasang dari `package-lock.json` (`npm ci --omit=dev`), dan build gagal bila ada paket eksternal yang tidak tercantum di `dependencies` server. Image memakai tiga tahap (build, dependensi produksi, runtime) dan berjalan sebagai pengguna `node`. Lihat `Dockerfile` dan `docs/DEPLOY.md`.

## Keputusan

Seluruh keputusan teknis, penyimpangan dari brief, dan hasil pengukuran ada di `docs/DECISIONS.md`. Token dan komponen desain ada di `docs/DESIGN.md`.
