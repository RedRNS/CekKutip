# Desain CekKutip

Konsep: **meja referensi pustakawan**. Rujukan visual: kartu katalog, lembar koreksi penyunting, tabel buku besar. Hasil pemeriksaan adalah ledger dengan verdict sebagai label stempel persegi berbingkai. Perbedaan antara kutipan dan record tampil seperti koreksi naskah: kata yang berbeda digarisbawahi.

Sumber kebenaran token: [apps/web/src/styles/tokens.css](../apps/web/src/styles/tokens.css). Jangan menambah warna di luar berkas itu.

## Token

| Token           | Nilai     | Pemakaian                                               |
| --------------- | --------- | ------------------------------------------------------- |
| `--paper`       | `#F6F8F7` | latar halaman                                           |
| `--surface`     | `#FFFFFF` | panel, input, baris hasil                               |
| `--ink`         | `#12232E` | teks utama                                              |
| `--ink-muted`   | `#4B5B66` | teks sekunder                                           |
| `--rule`        | `#C9D4D1` | garis hairline dekoratif                                |
| `--rule-strong` | `#6B7C78` | batas input dan kontrol                                 |
| `--brand`       | `#12343B` | wordmark, tombol utama, judul                           |
| `--brand-hover` | `#0C262C` | hover tombol utama (turunan brand)                      |
| `--accent`      | `#0B6B63` | tautan, fokus                                           |
| `--accent-tint` | `#E3F0EE` | latar sorotan lembut (model bahasa pada diagram, hover) |
| `--dev-warn`    | `#FFF8D6` | banner placeholder, hanya build pengembangan            |

Verdict (solid untuk grafis, ink untuk teks, tint untuk latar):

| Verdict      | Solid                   | Ink       | Tint      |
| ------------ | ----------------------- | --------- | --------- |
| Verified     | `#2E7D32`               | `#1E6B2A` | `#E7F3E8` |
| Mismatch     | `#C27D0E` (grafis saja) | `#8A5300` | `#FBF0DC` |
| Suspect      | `#C0392B`               | `#A32A1E` | `#F9E4E1` |
| Out-of-index | `#5F6B7A`               | `#465160` | `#E9ECEF` |

### Kontras (dihitung oleh `npx tsx scripts/contrast.ts`, 16 Nov 2026)

Semua pasangan lolos. Angka terukur, bukan salinan dari brief:

- ink pada paper 15,08:1. ink-muted pada paper 6,59:1, pada putih 7,03:1.
- accent pada paper 5,97:1, pada putih 6,37:1, pada accent-tint 5,45:1.
- putih pada brand 13,29:1. rule-strong pada putih 4,39:1, pada paper 4,12:1 (minimal 3:1).
- Teks ink pada putih: Verified 6,58, Mismatch 6,33, Suspect 7,22, Out-of-index 8,06. Pada tint: 5,76, 5,61, 5,92, 6,79.
- Solid untuk grafis pada putih: Verified 5,13, Mismatch 3,37, Suspect 5,44, Out-of-index 5,43 (minimal 3:1). Solid Mismatch tidak dipakai untuk teks.

## Tipografi

- Newsreader 500 dan 600 (judul), IBM Plex Sans 400/500/600 (UI), IBM Plex Mono 400 (DOI, kode, nomor). Self-host lewat `@fontsource`, subset Latin, `font-display: swap`.
- Newsreader dipasang statis (bukan varian `opsz`) karena varian optik 132 KB per gaya, sedangkan statis sekitar 24 KB. Brief meminta ukuran optik hanya "bila tersedia"; biayanya tidak sepadan.
- Skala: 14, 16, 18, 22, 30, 44 px. Judul halaman 44 px (28 px di ponsel). Tinggi baris isi 1,5. Lebar baca 68 karakter. Semua teks rata kiri.

## Tata letak

- Lebar maksimum 1180 px, gutter 24 px (16 px di ponsel). Rata kiri dan asimetris: judul di kiri, workbench lebar penuh.
- Workbench: dua panel 5:7 dari 900 px ke atas. Di bawah itu bertumpuk. Pada layar kecil tombol Check melekat di bawah panel input selama ada teks.
- Radius 2 px (kontrol, label), 4 px (panel). Tanpa bayangan, tanpa gradien, tanpa blur. Pemisah: hairline 1 px.
- Header: wordmark teks `CekKutip`, navigasi teks, pengalih bahasa. Di ponsel navigasi turun ke baris kedua (tanpa menu hamburger, jadi semua tautan langsung terlihat dan terjangkau).

## Komponen

- **VerdictLabel**: tinggi 28 px, huruf kapital 12 px, jarak huruf 0,06em, bobot 600, bingkai 1,5 px warna solid, latar tint, teks ink. Glif 16 px buatan tangan dengan siluet berbeda: lingkaran + centang, belah ketupat + dua garis bergeser, segitiga + seru, persegi putus-putus + garis. Out-of-index berbingkai putus-putus (abstain). Status `check_failed` memakai bingkai titik-titik netral dan teks "Could not check"; ia bukan verdict.
- **Legend**: daftar definisi empat verdict. Dipakai di panel hasil yang kosong dan di bawah workbench.
- **FieldTable**: perbandingan dua kolom. Kata yang berbeda digarisbawahi 2 px warna solid verdict, dan kolom status selalu menulis keadaannya dengan teks (agree, differs, not cited, not found). Di bawah 640 px tabel menjadi kartu bertumpuk.
- **PipelineDiagram**: SVG buatan tangan, dua tata letak (lebar dan sempit). Langkah Parse memakai aksen dan label "Language model"; tiga lainnya "No model".
- **Tombol**: utama (brand, teks putih, tinggi 44), sekunder (bingkai rule-strong). Fokus: cincin 2 px accent, offset 2 px.
- **Pengalih bahasa**: dua tombol (EN, ID) dengan `aria-pressed`, target 44 px.

## Gerak

Belum ada gerak di M1 selain perubahan keadaan fokus. `prefers-reduced-motion` mematikan semua animasi dan transisi di `base.css`. Gerak baris hasil (opasitas dan geser 4 px, 150 ms) dibuat di M4.

## Daftar periksa 9.9 (M1, diperiksa 16 Nov 2026 pada tangkapan layar 375/768/1280, EN dan ID)

1. Layar pertama menampilkan alat: ya.
2. Tanpa gradien, blur, gumpalan, ikon percikan atau robot, emoji: ya (diuji juga oleh `copy.test.ts` untuk emoji).
3. Tanpa tiga kartu fitur dengan ikon: ya. Bagian "How a check works" berupa empat langkah pada garis tipis.
4. Rata kiri dan asimetris: ya.
5. Warna selain netral hanya untuk verdict, tautan, fokus: ya. Pengecualian yang disengaja: accent-tint pada node Parse di diagram, untuk menandai satu-satunya langkah yang memakai model.
6. Verdict dapat dibedakan tanpa warna (glif, bingkai putus-putus, teks): ya.
7. Semua angka dan klaim berasal dari data atau kode: ya. Halaman Evaluation tidak memuat angka. Contoh di How it works memakai referensi nyata yang dua detailnya diubah dan dinyatakan begitu di halaman. Catatan: pencocokan dengan record Crossref belum dijalankan lewat pipeline (dijadwalkan M4).
8. Tanpa bayangan besar, radius besar, tombol pil: ya.
9. Kontras: ya (tabel di atas).
10. Alur utama dengan keyboard: elemen interaktif semuanya `button`, `a`, `input`, `textarea` bawaan dengan fokus terlihat. Uji alur keyboard penuh di M4 (E2E).
11. Lebar 375 px tanpa guliran horizontal dan tombol Check mudah dijangkau: ya (skrip tangkapan layar memeriksa overflow pada tiap halaman).
12. Teks dapat dipahami mahasiswa tingkat satu: penilaian saya, ya. Perlu dikonfirmasi pada uji pengguna.

## Tangkapan layar

`docs/screenshots/<state>-<lebar>[-id].png`. Dibuat oleh `npx tsx scripts/screenshots.ts [baseUrl] [en|id]`. Skrip yang sama menjalankan axe (WCAG 2.2 AA) dan memeriksa guliran horizontal pada tiap state. Hasil M1: nol pelanggaran, nol overflow, enam state, tiga lebar, dua bahasa.

## Workbench (M4)

- **Baris ledger:** nomor (mono, dua digit), referensi sebagaimana ditulis (dua baris, terbuka penuh saat rincian dibuka), label verdict, kalimat alasan dari templat, tombol buka rincian 44 px. Tinggi minimum 56 px. Baris muncul dengan opasitas dan geser 4 px selama 150 ms.
- **Baris menunggu:** teks referensi berwarna redup dan kata "CHECKING". Tanpa kerangka abu-abu berkedip.
- **Bilah ringkasan:** 12 px, pola per verdict (Verified solid, Mismatch garis diagonal, Suspect titik rapat, Out-of-index kotak berbingkai putus-putus, Could not check bingkai titik-titik). Bagian yang belum selesai dibiarkan kosong. Di bawahnya tombol filter dengan glif, nama, dan hitungan.
- **Panel bukti:** tabel perbandingan, langkah berikutnya, tombol "Open record" atau "Search on Google Scholar", dan bagian Details (skor, tipe yang terbaca, pembaca field, kode alasan).
- **Galat:** banner netral dengan garis kiri tebal warna ink, judul, kalimat, dan tombol "Try again". Galat batas muncul di bawah kotak teks dengan `role="alert"`.
- **Ponsel:** panel bertumpuk. Tombol Check melekat di bawah layar selama kotak teks berisi. Setelah Check ditekan, halaman bergulir ke hasil.

### Daftar periksa 9.9 untuk M4 (16 Nov 2026, tangkapan layar 375/768/1280, EN dan ID)

Semua dijawab ya. Buktinya: 32 tes E2E (alur contoh, filter, panel bukti, ekspor, bahasa, mode tanpa AI, batas, galat jaringan, alur keyboard penuh, 375 px tanpa guliran horizontal), axe WCAG 2.2 AA tanpa pelanggaran pada 7 state di 3 lebar dan 2 bahasa, dan tanpa galat konsol di bawah CSP ketat. Butir 12 (teks dipahami mahasiswa tingkat satu) tetap penilaian saya dan perlu uji pengguna.

## Halaman Evaluation dengan hasil (M6)

- Urutan: fakta cara hasil dibuat (versi, commit, model, tanggal, ambang, interval, ukuran data), lalu satu bagian per split (pengembangan, lalu uji), lalu kesepakatan pelabel, lalu penjelasan metrik.
- Tiap split: perbandingan utama (akurasi), waktu dan biaya, F1 per verdict, verdict melawan bukan verdict, ablation sebagai perubahan terhadap pipeline penuh, dan dengan lawan tanpa referensi yang diubah.
- Semua tabel adalah `table` sungguhan dengan `caption`, `th scope`, angka rata kanan dengan `tabular-nums`. Nama verdict tidak diterjemahkan. Angka mengikuti bahasa (titik desimal di Inggris, koma di Indonesia).
- Tabel yang lebih lebar dari layar menggulir di dalam kotaknya sendiri (`role="region"`, `tabindex="0"`, nama dari caption), tidak pernah membuat halaman bergulir ke samping.
- Tanpa grafik. Tidak ada angka yang dihitung di browser.
- Keadaan kosong tetap: judul, "Results will be published after data lock on 9 December 2026.", dan catatan bahwa halaman tidak menampilkan angka sampai ada hasil terukur.
