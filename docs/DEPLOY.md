# Deploy CekKutip

CekKutip adalah satu layanan Node yang melayani API dan aplikasi web hasil build, dalam satu image Docker (`Dockerfile`). Dokumen ini menjelaskan host yang saya rekomendasikan, langkahnya, dan yang harus disiapkan sebelum demo ke juri. Fakta tentang host diperiksa pada **18 November 2026**. Ketentuan host gratis sering berubah, jadi baca ulang halaman resminya sebelum bergantung padanya.

## Yang harus beres sebelum deploy

1. **Isi `apps/web/src/site.config.ts`** (nama tim, anggota, pembimbing, kampus, email kontak, tautan GitHub, tautan demo). Selama masih ada `TODO`, build produksi gagal dengan sengaja, termasuk `docker build`. Jangan memakai `--build-arg ALLOW_TODO=1` untuk deploy sungguhan.
2. **Siapkan kunci:** `GEMINI_API_KEY` (wajib untuk mode AI), `CROSSREF_MAILTO` (alamat kontak yang dikirim ke Crossref, disarankan), `OPENALEX_API_KEY` (gratis, sangat disarankan, lihat DECISIONS no. 21). Kunci hanya masuk ke variabel lingkungan host, tidak pernah ke repo.
3. **Komit hasil evaluasi** (`eval/results/summary.json`) hanya bila sudah dari data sungguhan dan sudah ditinjau. Berkas itu ikut ke dalam image saat build. Tanpa berkas itu, halaman Evaluation menampilkan keadaan kosong yang jujur.

## Memilih host

Kebutuhannya: menjalankan image Docker, gratis, dekat dengan pengguna di Indonesia, dan tidak membuat demo menunggu.

| Host                                     | Yang terverifikasi (18 Nov 2026)                                                                                                                                                                                                                                                                                                                                           | Catatan                                                                                                                                                           |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Render, web service gratis** (dipilih) | Mendukung `runtime: docker`. Plan gratis 0,1 CPU dan 512 MB. Region `singapore` tersedia. Tidur setelah **15 menit** tanpa permintaan masuk, dan bangun lagi dalam sekitar **satu menit** (halaman resmi: [render.com/docs/free](https://render.com/docs/free)). 750 jam instance gratis per bulan per workspace. Sistem berkas hilang saat redeploy, restart, atau tidur. | Paling sederhana: satu berkas `render.yaml`, tanpa konfigurasi jaringan. **Kelemahan utama: tidur dan bangun satu menit.** Lihat bagian berikutnya.               |
| Google Cloud Run                         | Tier gratis: 2 juta permintaan per bulan dan sejumlah vCPU-detik dan GiB-detik (angkanya berbeda menurut mode dan region, lihat [cloud.google.com/run/pricing](https://cloud.google.com/run/pricing)). Berskala ke nol.                                                                                                                                                    | **Perlu akun penagihan (kartu).** Waktu bangun dan biaya instance minimum tidak saya verifikasi. Region Jakarta ada, tetapi tidak saya periksa untuk tier gratis. |
| Koyeb                                    | Sumber saling bertentangan tentang apakah layanan web gratis masih ada.                                                                                                                                                                                                                                                                                                    | Tidak dipilih karena tidak terverifikasi.                                                                                                                         |
| Fly.io                                   | Dilaporkan tidak punya tier gratis berarti untuk akun baru.                                                                                                                                                                                                                                                                                                                | Tidak dipilih.                                                                                                                                                    |
| Hugging Face Spaces                      | Dilaporkan memerlukan paket berbayar untuk Space Docker.                                                                                                                                                                                                                                                                                                                   | Tidak dipilih.                                                                                                                                                    |
| Host Docker apa pun                      | Lihat "Host lain" di bawah.                                                                                                                                                                                                                                                                                                                                                | Image-nya portabel.                                                                                                                                               |

**Alasan memilih Render:** satu-satunya opsi yang saya verifikasi menjalankan Docker, gratis tanpa pernyataan perlu kartu, punya region Singapura, dan paling sedikit langkahnya. Alasan itu bukan klaim bahwa Render terbaik. Bila tim sudah punya akun di host lain, image ini jalan di sana juga.

## Cold start dan demo ke juri

Layanan gratis Render **tidur setelah 15 menit tanpa permintaan** dan butuh sekitar satu menit untuk bangun. Demo ke juri tidak boleh menunggu itu. Pilihan, dari yang paling sederhana:

1. **Bangunkan sebelum demo.** Buka `https://<alamat-anda>/api/health` lima menit sebelum mulai, dan pastikan jawabannya `{"status":"ok",...}`. Lalu jalankan daftar contoh sekali (lihat "Pemanasan") supaya pencarian sudah ada di cache.
2. **Pemantau gratis dari luar** yang memanggil `/api/health` tiap 10 sampai 14 menit, supaya layanan tidak pernah tidur. Ini layanan pihak ketiga (misalnya UptimeRobot), jadi keputusan tim. Panggilannya tidak membawa data pengguna. Hitungan jam: satu layanan yang selalu bangun memakai sekitar 720 sampai 744 jam sebulan, di bawah jatah 750 jam, tetapi hampir tanpa sisa.
3. **Paket berbayar** menghilangkan tidur. Harganya tidak saya verifikasi, dan anggaran proyek hampir nol, jadi ini keputusan tim.
4. **Rencana cadangan:** jalankan lokal dengan Docker (perintah di bawah), dan siapkan rekaman layar demo 90 detik.

Setelah tidur, cache pencarian di memori hilang. Daftar contoh yang pertama kali dijalankan butuh sekitar 13 detik, lalu 2 sampai 3 detik (diukur terhadap image ini pada 18 November 2026 dengan layanan nyata dan Gemini; hasil di Render bisa berbeda karena CPU 0,1).

### Pemanasan sebelum demo

```
npx tsx scripts/check-examples.ts https://<alamat-anda> llm
```

Skrip itu mencetak verdict tiap contoh. Pada 18 November 2026, daftar contoh memberi 3 Verified, 2 Mismatch, 2 Suspect, 3 Out-of-index. Bila hasilnya berbeda, ganti entri daftar contoh, **jangan ubah aturan** (DECISIONS, bagian "Daftar contoh").

## Langkah deploy ke Render

1. Dorong repo ke GitHub (privat tidak masalah). Pastikan `site.config.ts` sudah terisi.
2. Di Render: **New, Blueprint**, pilih repo. Render membaca `render.yaml` (runtime docker, plan free, region singapore, `healthCheckPath: /api/health`).
3. Render menanyakan nilai variabel rahasia (`GEMINI_API_KEY`, `CROSSREF_MAILTO`, `OPENALEX_API_KEY`, `PUBLIC_SITE_URL`). Isi di sini. Nilainya tidak masuk ke repo.
4. Tunggu build selesai. Buka `https://<layanan>.onrender.com/api/health`. Jawaban yang benar: `{"status":"ok","version":"0.1.0","uptimeSeconds":...}`.
5. Buka `https://<layanan>.onrender.com/api/config`. Bila `aiAvailable` bernilai `false`, `GEMINI_API_KEY` belum terbaca.
6. Jalankan pemanasan di atas, lalu ukur dengan PageSpeed Insights pada alamat itu (angka itu yang dibandingkan juri).
7. Isi `demoUrl` di `site.config.ts` dengan alamat itu, dan deploy ulang.

`render.yaml` memakai `autoDeployTrigger: commit`, jadi setiap komit ke cabang utama memicu build baru. Ubah ke `off` bila tidak diinginkan, terutama mendekati hari demo.

## Menjaga layanan tetap bangun dengan UptimeRobot (gratis)

Layanan gratis Render tidur setelah 15 menit tanpa permintaan. UptimeRobot memanggil alamat kita tiap 5 menit (paket gratis: 50 monitor, interval 5 menit, tanpa kartu kredit; diperiksa 19 Nov 2026), jadi layanan tidak sempat tidur, dan UptimeRobot juga mengirim email bila situs mati.

1. Daftar di uptimerobot.com (gratis, tanpa kartu).
2. Di dashboard klik **+ New monitor**.
3. **Monitor Type:** HTTP(s). **Friendly Name:** CekKutip. **URL:** `https://cekkutip.onrender.com/api/health`. **Monitoring Interval:** 5 menit (batas terkecil paket gratis).
4. Isi kontak notifikasi (email), lalu **Create Monitor**.
5. Setelah beberapa menit statusnya **Up**. Cek di Render, tab Logs: ada permintaan `/api/health` yang berkala.

Hitungan jam: satu layanan yang selalu bangun memakai sekitar 720 sampai 744 jam sebulan, di bawah jatah gratis 750 jam per workspace, tetapi nyaris tanpa sisa. Jangan menjalankan layanan Render gratis lain di workspace yang sama. Panggilan ke `/api/health` tidak membawa data pengguna. Tampilan UptimeRobot bisa berbeda sedikit dari langkah di atas.

## Host lain (Docker apa pun)

```
docker build -t cekkutip .
docker run --rm -p 8787:8787 \
  -e GEMINI_API_KEY=... -e CROSSREF_MAILTO=... -e OPENALEX_API_KEY=... \
  cekkutip
```

Atau `--env-file .env`. Image berjalan sebagai pengguna `node` (bukan root), tidak menulis ke disk, dan punya `HEALTHCHECK` yang memanggil `/api/health`. Host biasanya mengatur `PORT` sendiri, dan server membacanya.

**`TRUST_PROXY`:** server membaca alamat IP pengguna untuk batas laju. Di produksi nilai bawaannya 1 (satu reverse proxy di depan, seperti di Render). Bila host punya dua lapisan proxy, atur `TRUST_PROXY=2`. Bila salah, semua pengguna tampak berasal dari satu IP dan batas laju mengenai semuanya sekaligus.

### Variabel lingkungan

Daftar lengkap dengan komentar ada di `.env.example`. Yang paling penting di produksi:

| Variabel                                 | Untuk apa                                                                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `GEMINI_API_KEY`                         | Kunci mode AI. Tanpa ini server tetap jalan, memakai pembaca pola, dan `/api/config` melapor `aiAvailable: false`. |
| `GEMINI_MODEL`                           | Bawaan `gemini-3.1-flash-lite`.                                                                                    |
| `CROSSREF_MAILTO`                        | Alamat kontak untuk "polite pool" Crossref (10 permintaan per detik, 3 bersamaan, dibanding 5 dan 1).              |
| `OPENALEX_API_KEY`                       | Kunci gratis: anggaran $1 per hari, dibanding $0,10 per hari per IP tanpa kunci.                                   |
| `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS` | Bawaan 10 pemeriksaan per 10 menit per IP.                                                                         |
| `MAX_REFERENCES`, `MAX_REFERENCE_CHARS`  | Bawaan 40 dan 600. Ditegakkan di server.                                                                           |
| `TRUST_PROXY`                            | Jumlah proxy di depan server (lihat di atas).                                                                      |
| `PUBLIC_SITE_URL`                        | Alamat publik situs.                                                                                               |
| `ENABLE_EXPERIMENT_MODES`                | **Harus tetap `false`.** Server juga menolaknya selama `NODE_ENV=production`.                                      |

Variabel yang diatur image: `NODE_ENV=production`, `STATIC_DIR=/app/web`, `EVALUATION_SUMMARY=/app/eval/results/summary.json`.

## Memeriksa sebuah deploy

```
curl https://<alamat>/api/health          # {"status":"ok","version":...}
curl https://<alamat>/api/config          # aiAvailable true bila kunci terbaca
curl -I https://<alamat>/                 # content-security-policy, content-encoding: gzip bila diminta
npx tsx scripts/check-examples.ts https://<alamat> llm
npx tsx scripts/lighthouse.ts https://<alamat>
```

Sebelum rilis: `npm audit --omit=dev` (harus 0), `npm test`, `npm run test:e2e`, dan `npx tsx scripts/verify-production.ts` (memeriksa artefak produksi di folder bersih tanpa Docker).

## Hasil uji image (18 November 2026)

Dibangun dan dijalankan di Docker Desktop lokal, bukan di Render:

- Build tanpa `ALLOW_TODO` **gagal** di gerbang `TODO`, seperti seharusnya. Build dengan `--build-arg ALLOW_TODO=1` berhasil. Ukuran image 297 MB (Node 22 alpine, 47 MB dependensi produksi).
- Kontainer berjalan sebagai `node`, status `healthy`.
- Seluruh suite E2E (43 tes) lulus dua kali terhadap kontainer, dengan CSP produksi.
- Daftar contoh, dengan layanan nyata dan Gemini, tiga kali berturut-turut: 12,7 detik, 3,1 detik, 2,2 detik, dengan verdict yang sama setiap kali.

**Belum diuji pada hari itu:** deploy ke Render itu sendiri, waktu bangun nyata di sana, PageSpeed Insights pada alamat publik, dan uji di perangkat nyata.

## Hasil uji situs publik (19 November 2026)

Situs di `https://cekkutip.onrender.com` (Render, gratis, Singapore), diuji dari komputer pengembang:

- `/api/health` `ok` dan `/api/config` `aiAvailable: true`.
- Daftar contoh dengan pembaca AI, tiga putaran: 3, 2, 2, 3 (Verified, Mismatch, Suspect, Out-of-index) pada dua putaran, dan satu `Could not check` pada putaran pertama saat layanan masih dingin. Median latensi 0,5 sampai 0,7 detik setelah hangat.
- Lighthouse (ponsel, throttling bawaan): Performance 96 sampai 100, Accessibility, Best Practices, dan SEO 100, CLS 0.

**Masih perlu:** PageSpeed Insights, uji di HP sungguhan, dan rencana bangun-dari-tidur sebelum demo (bagian "Cold start"). Untuk hari demo, naikkan `RATE_LIMIT_MAX` di Render (bawaan 10 pemeriksaan per 10 menit per IP) karena juri dan peserta di satu jaringan kampus berbagi satu IP.

## Masalah yang mungkin muncul

| Gejala                                                                                   | Penyebab dan jalan keluar                                                                                                                              |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Build gagal: `site.config.ts still has N TODO placeholder(s)`                            | Isi `site.config.ts`. Ini sengaja.                                                                                                                     |
| Kotak "tanpa AI" tercentang dan nonaktif, pemberitahuan bilang pembaca AI belum dipasang | `GEMINI_API_KEY` kosong atau tidak terbaca. Periksa `/api/config`.                                                                                     |
| Banyak pengguna cepat mendapat "Kamu sudah mencapai batas pemeriksaan"                   | Batas 10 per 10 menit per IP. Naikkan `RATE_LIMIT_MAX`, dan periksa `TRUST_PROXY`.                                                                     |
| Banyak hasil `Could not check`                                                           | Crossref atau OpenAlex lambat atau menolak. Isi `CROSSREF_MAILTO` dan `OPENALEX_API_KEY`. Cek log: baris `lookup_error` hanya memuat kode, bukan teks. |
| Halaman Evaluation tetap kosong                                                          | Belum ada `eval/results/summary.json` di image, atau berkasnya bertanda `sample` atau tidak lengkap. Itu perilaku yang benar.                          |
| Layanan lambat di menit pertama                                                          | Bangun dari tidur (host gratis). Lihat "Cold start".                                                                                                   |
