# Harness evaluasi CekKutip

Bukti utama untuk paper. Harness memakai kode pipeline yang sama dengan produk, jadi baseline dan ablation hanyalah konfigurasi, bukan salinan kode.

## Yang harus diisi tim

1. Salin `eval/data/references.template.csv` menjadi `eval/data/references.csv`, lalu ganti semua barisnya. Panduan pelabelan ada di komentar berkas itu.
2. Target: 130 referensi, 80 `dev` dan 50 `test`. Isi `labeler1` dan `labeler2` secara terpisah **sebelum** membandingkan. `gold_label` adalah label yang disepakati.
3. Isi `PRICE_INPUT_PER_M` dan `PRICE_OUTPUT_PER_M` di `.env` dari daftar harga Google yang berlaku, supaya biaya per 1.000 referensi bisa dihitung.

Selama `references.csv` belum ada, skrip memakai templat. Hasilnya otomatis ditandai **sample**, ditulis ke `eval/results-sample/` (tidak di-commit), dan tidak boleh ditulis ke `eval/results/`. Halaman Evaluation hanya membaca `eval/results/summary.json`.

## Urutan kerja

```
npm run eval:kappa                                   # kesepakatan dua pelabel (Cohen kappa)
npm run eval:tune                                    # pilih TAU_T, TAU_A, TAU_L, TAU_V pada dev saja
# bekukan nilainya di docs/DECISIONS.md bersama hash commit
npm run eval -- --split test --system cekkutip --out eval/results
npm run eval -- --split test --system cekkutip --ablation a1 --out eval/results   # a1, a2, a3, a4
npm run eval -- --split test --system b1_llm_only --out eval/results
npm run eval -- --split test --system b2_crossref_top1 --out eval/results
npm run eval -- --split test --system b3_doi_check --out eval/results
npm run eval:report                                  # summary.json dan report.md (tabel siap salin)
```

Jalankan split `test` **sekali**, setelah ambang dibekukan. Jangan mengubah aturan atau ambang setelah melihat hasil test.

## Sistem dan ablation

| Nama               | Isi                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------ |
| `cekkutip`         | pipeline penuh                                                                                               |
| `b1_llm_only`      | model yang sama menjawab satu dari empat verdict tanpa pencarian                                             |
| `b2_crossref_top1` | hasil teratas Crossref. `verified` bila skor judul mencapai ambang (dituning pada dev), selain itu `suspect` |
| `b3_doi_check`     | `verified` bila ada DOI di teks dan terdaftar di Crossref, selain itu `suspect`                              |
| ablation `a1`      | tanpa abstain (`out_of_index` menjadi `suspect`)                                                             |
| ablation `a2`      | tanpa OpenAlex (juga tanpa pandangan kedua T2)                                                               |
| ablation `a3`      | parser regex menggantikan model                                                                              |
| ablation `a4`      | tanpa pengecekan penulis                                                                                     |

Sistem hanya menerima id dan teks referensi. Label emas tidak pernah masuk ke pipeline (dibuktikan tes).

## Metrik

Macro-F1 (metrik utama, rata-rata F1 empat verdict yang muncul di label emas), precision, recall, dan F1 per verdict, false accusation rate (dari referensi berlabel emas `verified` atau `out_of_index`, berapa yang diberi `suspect` atau `mismatch`), tingkat abstain, latensi median, token dan biaya per 1.000 referensi, serta perbandingan biner `verified` melawan bukan `verified` untuk B2 dan B3. Interval kepercayaan 95% memakai bootstrap persentil, 1.000 resampel, seed tetap 20261209. Hasil `check_failed` dihitung salah, dan bukan tuduhan maupun abstain. Setiap berkas hasil mencatat versi alat, hash commit, ambang, model, tanggal, dan hash dataset. Angka dengan dan tanpa item `perturbed` dilaporkan terpisah.

## Dapat diulang

Pencarian disimpan di `eval/cache/retrieval` dan jawaban model di `eval/cache/model` (nama berkas berupa hash, isinya metadata publik dan keluaran model, bukan teks referensi). `--replay-only` menjalankan ulang tanpa jaringan dan tanpa model, dan memberi prediksi, metrik, interval, dan jumlah token yang identik. **Latensi hanya bermakna pada jalan yang mengisi cache**: jalan ulang memutar balik pencarian dan jawaban model sehingga tampak jauh lebih cepat. Jalankan satu kali per sistem dengan cache kosong bila latensi akan dilaporkan.

Cache dan `eval/results-sample/` diabaikan git. Simpan `eval/cache` di tempat lain bila ingin menyertakannya sebagai lampiran paper.
