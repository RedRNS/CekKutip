# CekKutip

Pemeriksa referensi untuk mahasiswa Indonesia. Tempel daftar pustaka, dan CekKutip mencari tiap referensi di Crossref dan OpenAlex lalu memberi satu dari empat verdict (arXiv dan Zenodo lewat DataCite):

| Verdict          | Arti                                                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Verified**     | Karyanya ditemukan, dan judul, penulis, serta tahunnya sesuai.                                                                       |
| **Mismatch**     | Karyanya ditemukan, tetapi sebagian detail yang dikutip tidak sesuai dengan recordnya.                                               |
| **Suspect**      | Karyanya tidak ditemukan, padahal ditulis seperti artikel jurnal (atau DOI-nya tidak terdaftar).                                     |
| **Out-of-index** | Jenis sumber yang sering tidak ada di indeks (buku, skripsi, laporan), jadi alat ini tidak bisa memastikan dan berkata terus terang. |

Model bahasa **hanya membaca** teks referensi menjadi field (penulis, tahun, judul, dan seterusnya). Model tidak pernah memutuskan verdict. Verdict datang dari aturan tetap yang bisa diaudit atas data Crossref dan OpenAlex. Kalau bukti kurang, hasilnya `Out-of-index` atau `Could not check`, bukan tebakan. Verdict adalah ajakan untuk memeriksa ulang, bukan temuan pelanggaran.

Dibuat untuk GYIIF 2027 (kategori Engineering and Technology). Pembeda dari pemeriksa lain: verdict `Mismatch` untuk karya nyata yang dikutip keliru, verdict abstain `Out-of-index`, dan evaluasi pada referensi mahasiswa Indonesia.

## Tim

Kelompok **Halu Hunters**, Teknik Informatika, Telkom University Purwokerto. Anggota: Renisa Assyifa Putri (ketua), Shellyn Euriska Putri, Nadira Hikmah Fatheena, Fauza Kaizaku Setiawan, Arkaan Wisnu Pratama, Regita Hutri Cahyaningrum. Dosen pembimbing: Dany Candra Febrianto, S.Kom., M.Eng.

Video demo, buku manual, dan arsip lain untuk pengguna ada di [folder Google Drive tim](https://drive.google.com/drive/folders/1vPRw8e8778n8S_w2c4RgPBTmzjuVsklV?usp=sharing).

## Fitur selain pemeriksaan dasar (P1)

- **DOI arXiv dan Zenodo** diperiksa lewat DataCite, bukan langsung `Out-of-index`.
- **Pratinjau pemisahan** di bawah kotak teks: gabungkan atau ubah referensi yang terpotong salah.
- **Unggah `.txt` atau `.bib`** (dibaca di browser, sampai 256 KB).
- **Salin referensi yang dikoreksi** (APA 7) dari record untuk hasil `Mismatch`, ditulis dengan aturan tetap, bukan model bahasa.
- **Cetak** hanya hasil sebagai laporan (Ctrl+P).

## Kunci Gemini sendiri dan ekstensi browser

- **Kunci Gemini milik pengguna:** di situs, buka "Use your own Gemini API key", tempel kuncinya. Dengan begitu pembacaan referensi memakai jatah kuncimu, bukan kunci bersama yang bisa habis. Kunci tetap di browser, dikirim ke server dalam satu header, tidak disimpan dan tidak dicatat di log.
- **Ekstensi browser** (Chrome, Edge, Brave): periksa referensi dari popup, atau pilih teks di halaman web lalu klik kanan. Kunci Gemini dibagi otomatis antara situs dan ekstensi. Situs punya halaman **Extension** (`/extension`) dengan tombol unduh dan langkah pemasangan; berkas zipnya dibangun otomatis pada setiap build situs. Panduan teknis: [extension/README.md](extension/README.md).

## Menjalankan di komputermu

Butuh Node.js 22 atau lebih baru (image Docker memakai 22; skrip `dev` dan `start` memakai opsi `--env-file-if-exists`).

```
npm install
cp .env.example .env        # di Windows: copy .env.example .env. Lalu isi, lihat tabel di bawah
npm run dev                 # server API di http://localhost:8787
npm run dev:web             # aplikasi web di http://localhost:5173 (di terminal lain)
```

`npm run dev:web` meneruskan `/api` ke server di `:8787`. Untuk menjalankan seperti produksi (satu proses yang melayani API dan web):

```
npm run build               # butuh site.config.ts terisi, lihat "Yang harus diisi tim"
npm start                   # http://localhost:8787
```

Tanpa `GEMINI_API_KEY` semuanya tetap jalan dengan pembaca pola (mode tanpa AI), dan antarmuka mengatakannya.

### Variabel lingkungan

Daftar lengkap dengan komentar ada di `.env.example`. Yang utama:

| Variabel                                  | Untuk apa                                                                             |
| ----------------------------------------- | ------------------------------------------------------------------------------------- |
| `GEMINI_API_KEY`                          | Kunci Google Gemini (hanya di server). Tanpa ini, mode AI tidak tersedia.             |
| `GEMINI_MODEL`                            | Bawaan `gemini-3.1-flash-lite`.                                                       |
| `CROSSREF_MAILTO`                         | Alamat kontak untuk "polite pool" Crossref. Disimpan di `.env`, tidak pernah di repo. |
| `OPENALEX_API_KEY`                        | Kunci gratis OpenAlex (anggaran harian 10 kali lipat dibanding tanpa kunci).          |
| `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`  | Batas laju `/api/check`. Bawaan 10 per 10 menit per IP.                               |
| `MAX_REFERENCES`, `MAX_REFERENCE_CHARS`   | Batas masukan, ditegakkan di server. Bawaan 40 dan 600.                               |
| `ENABLE_EXPERIMENT_MODES`                 | Hanya untuk harness evaluasi. Selalu mati di produksi.                                |
| `RETRIEVAL_CACHE_DIR`                     | Cache berkas untuk evaluasi (merekam dan memutar ulang pencarian).                    |
| `PRICE_INPUT_PER_M`, `PRICE_OUTPUT_PER_M` | Harga per juta token, untuk biaya per 1.000 referensi di laporan evaluasi.            |
| `PUBLIC_SITE_URL`                         | Alamat publik situs.                                                                  |

## Tes

```
npm test                 # unit dan integrasi (Vitest), tanpa jaringan
npm run lint
npm run typecheck
npm run test:e2e         # Playwright terhadap server sungguhan dengan cache pencarian rekaman, tanpa jaringan
```

Tes tidak memakai jaringan dan tidak butuh kunci: respons Crossref, OpenAlex, dan doi.org direkam sebagai fixture. Alat bantu pemeriksaan langsung (memakai jaringan, dijalankan sendiri):

```
npm run smoke:live                              # klien nyata terhadap Crossref, OpenAlex, doi.org
npx tsx --env-file=.env scripts/smoke-gemini.ts # tahap Parse terhadap Gemini nyata
npx tsx scripts/check-examples.ts http://localhost:8787 llm   # verdict daftar contoh
npm run e2e:server && npm run lighthouse        # skor Lighthouse semua halaman
npm run screenshots                             # tangkapan layar 375/768/1280 + axe
```

## Evaluasi

Harness di `eval/` mengukur CekKutip terhadap tiga baseline dan empat ablation pada data berlabel, dengan interval kepercayaan bootstrap dan hasil yang bisa diulang persis. Panduan lengkap, termasuk format data dan urutan kerja, ada di [eval/README.md](eval/README.md).

```
npm run eval:kappa
npm run eval:tune
npm run eval -- --split test --system cekkutip --out eval/results
npm run eval:report
```

Halaman Evaluation hanya menampilkan `eval/results/summary.json` bila lengkap dan berasal dari data sungguhan. Sampai itu ada, halaman menampilkan keadaan kosong, bukan angka.

## Deploy

Satu image Docker (`Dockerfile`) dan satu `render.yaml`. Langkah, pilihan host, perilaku tidur dan bangun host gratis, dan daftar periksa sebelum demo ada di [docs/DEPLOY.md](docs/DEPLOY.md).

```
docker build -t cekkutip .
docker run --rm -p 8787:8787 --env-file .env cekkutip
```

## Yang harus diisi tim

- **`apps/web/src/site.config.ts`**: nama tim, anggota, pembimbing, kampus, email kontak, tautan GitHub dan demo. Selama masih ada `TODO`, build produksi **gagal dengan sengaja**, karena nilai itu tampil di halaman publik.
- **`eval/data/references.csv`**: data evaluasi (130 referensi, 80 dev dan 50 test, dua pelabel). Templatnya ada di `eval/data/references.template.csv`.
- **Daftar demo akhir**: contoh di `apps/web/src/data/example-list.ts` adalah daftar sementara dengan verdict yang sudah diperiksa.
- **Kunci dan alamat kontak** di `.env` dan di host.

## Struktur

```
packages/shared/   skema dan tipe (zod), pemisah referensi, normalisasi, tipe ringkasan evaluasi
apps/server/       Express, pipeline (parse, retrieve, match, decide), klien Crossref/OpenAlex/doi.org/Gemini
apps/web/          React + CSS biasa (token di styles/tokens.css), i18n EN dan ID, tes E2E
eval/              harness evaluasi, data, hasil
scripts/           alat bantu: build server, tangkapan layar, Lighthouse, verifikasi produksi, pemeriksaan langsung
docs/              PLAN, ARCHITECTURE, DECISIONS, DESIGN, DEPLOY
```

Mulai dari [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) untuk alur data. Semua keputusan teknis, penyimpangan dari rencana, dan hasil pengukuran ada di [docs/DECISIONS.md](docs/DECISIONS.md).

## Yang tidak dilakukan CekKutip

- Tidak memeriksa apakah sebuah sumber mendukung klaimmu.
- Tidak mendeteksi plagiarisme.
- Tidak bisa melihat buku, skripsi, dan laporan yang tidak dimuat Crossref dan OpenAlex, jadi berkata terus terang.
- Hasilnya bukan bukti pelanggaran, dan bukan pengganti membaca sumbermu.

## Privasi

Teks yang ditempel dikirim ke Google Gemini hanya untuk membaca field, kecuali pengguna memilih mode tanpa AI. Google menyatakan konten yang dikirim lewat tier gratis dapat dipakai untuk meningkatkan produknya. Judul, penulis, dan DOI hasil bacaan dikirim ke Crossref dan OpenAlex. Server tidak menyimpan teks pengguna, dan log hanya memuat id, jumlah, waktu, dan kode galat (dibuktikan tes). Rinciannya ada di halaman Privacy aplikasi.
