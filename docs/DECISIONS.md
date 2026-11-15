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

## Ambang final

Belum dituning. Nilai sementara: `TAU_T` 0,90, `TAU_A` 0,60, `TAU_L` 0,60, `TAU_V` 0,40. Diisi setelah `npm run eval:tune` pada dev set (M5): ambang, hash commit, tanggal.
