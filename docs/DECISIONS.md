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

## Ambang final

Belum dituning. Nilai sementara: `TAU_T` 0,90, `TAU_A` 0,60, `TAU_L` 0,60, `TAU_V` 0,40. Diisi setelah `npm run eval:tune` pada dev set (M5): ambang, hash commit, tanggal.
