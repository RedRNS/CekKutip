# Ekstensi browser CekKutip

Memeriksa daftar pustaka langsung dari browser, tanpa membuka situs. Ini alat yang sama dengan situs CekKutip: referensi dikirim ke server CekKutip, dicari di Crossref, OpenAlex, dan DataCite, lalu diberi satu verdict oleh aturan tetap (bukan oleh AI). Verdict adalah ajakan memeriksa, bukan tuduhan.

Untuk Chrome, Edge, dan Brave versi 127 ke atas (Manifest V3). Firefox belum diuji.

## Memasang

Ekstensi ini belum ada di toko ekstensi, jadi dipasang dari berkas.

1. Dapatkan berkasnya, salah satu:
   - **Dari situs (paling mudah):** buka halaman **Extension** di situs CekKutip dan tekan **Download the extension**. Berkasnya `cekkutip-extension.zip`. Ekstrak ke satu folder. Halaman itu juga memuat langkah pemasangan dalam EN dan ID.
   - **Zip dari tim:** `cekkutip-extension-<versi>.zip`. Ekstrak ke satu folder.
   - **Dari kode:** jalankan `npm install` lalu `npm run build:extension`. Hasilnya di `extension/dist`.
2. Buka `chrome://extensions` (di Edge: `edge://extensions`).
3. Nyalakan **Developer mode** (pojok kanan atas).
4. Klik **Load unpacked**, lalu pilih folder hasil ekstrak (atau `extension/dist`).
5. Klik ikon puzzle di toolbar dan **sematkan** CekKutip supaya mudah dibuka.

Untuk membuat zip yang bisa dibagikan: `npm run package:extension` (hasilnya `extension/cekkutip-extension-<versi>.zip`). Zip yang ditawarkan situs dibuat terpisah dan otomatis pada setiap build situs (`tsx scripts/package-extension.ts --site`, hasilnya `apps/web/dist/downloads/cekkutip-extension.zip`); jangan di-commit.

## Cara memakai

- **Klik ikon CekKutip.** Tempel referensi, lalu pilih **Check references**. Hasilnya sama seperti di situs: verdict, bukti, dan referensi yang dikoreksi (APA 7) untuk `Mismatch`.
- **Pilih teks di halaman web mana pun, klik kanan, lalu pilih "Check selection with CekKutip".** Teksnya dimasukkan ke popup. **Belum ada yang dikirim** sampai kamu memilih Check references. Kalau browser tidak mau membuka popup sendiri, ikon menampilkan tanda "1": klik ikonnya.
- Bahasa: tombol **EN | ID** di popup.

## Kunci Gemini milikmu sendiri

Secara bawaan, pembacaan referensi memakai kunci Gemini bersama milik situs, yang punya batas harian. Kalau banyak orang memakainya, jatah itu bisa habis. Kamu bisa memakai kunci gratismu sendiri:

1. Buat kunci di https://aistudio.google.com/apikey.
2. Di popup, buka **Use your own Gemini API key (optional)**, tempel kuncinya, lalu **Save key**.

**Kunci dibagi otomatis dengan situs CekKutip.** Simpan di ekstensi, dan situs mengenalinya begitu dibuka di browser yang sama. Simpan atau hapus di situs, dan ekstensi mengikutinya. Perubahan terakhir yang menang, dan penghapusan ikut tersampaikan. Sinkronisasi ini hanya terjadi di satu browser pada satu perangkat: kunci tidak dikirim ke akun Google atau ke perangkat lain.

Kalau Google menolak kuncinya, atau jatahnya habis, hasil tetap keluar (dibaca oleh pembaca tanpa AI) dan ada pemberitahuan yang menjelaskannya.

## Izin yang diminta, dan alasannya

| Izin                         | Untuk apa                                                                                          |
| ---------------------------- | -------------------------------------------------------------------------------------------------- |
| `storage`                    | Menyimpan kunci Gemini milikmu di perangkatmu, dan teks pilihan yang menunggu popup.               |
| `contextMenus`               | Item klik kanan "Check selection with CekKutip".                                                   |
| Akses ke situs CekKutip saja | Popup memanggil API CekKutip, dan satu skrip kecil di halaman CekKutip membagi kunci dengan situs. |

Tidak ada akses ke tab lain, riwayat, cookie, atau situs lain. Ekstensi tidak membaca isi halaman yang kamu kunjungi: yang diterimanya hanya teks yang kamu pilih lalu klik kanan.

## Privasi

- Teks referensi dikirim ke server CekKutip **hanya saat kamu memilih Check references**, dengan aturan privasi yang sama seperti situs: tidak disimpan, tidak masuk log.
- Kunci Gemini disimpan di browsermu (`chrome.storage.local`, tidak disinkronkan lewat akun Google). Kunci dikirim ke server CekKutip dalam satu header pada setiap pemeriksaan yang memakai pembaca AI, dipakai hanya untuk meminta Google membaca referensimu, dan tidak pernah disimpan atau dicatat di log (dibuktikan tes).
- Memilih "Do not send my text to an AI service" berarti kunci tidak dikirim sama sekali.

## Membangun untuk server lain

Secara bawaan ekstensi berbicara dengan alamat di `apps/web/src/site.config.ts` (`demoUrl`). Untuk server lain (misalnya lokal):

```
CEKKUTIP_URL=http://localhost:8787 npm run build:extension
```

Alamat harus `https`, kecuali `localhost`. Manifes hanya meminta akses ke alamat itu.

## Untuk pengembang

```
npm run build:extension      # extension/dist
npm run package:extension    # zip untuk dibagikan
npm test                     # termasuk logika sinkronisasi dan menu (extension/test)
npm run test:extension       # Playwright: Chromium sungguhan memuat ekstensi
```

- `src/popup/`: popup. Memakai komponen yang sama dengan situs (`WorkbenchCore`), diarahkan ke server CekKutip.
- `src/bridge.ts` dan `src/bridge-core.ts`: skrip yang berjalan di halaman CekKutip dan membagi kunci. Logikanya (`bridge-core.ts`) murni dan diuji tanpa browser.
- `src/background.ts` dan `src/menu.ts`: item klik kanan.
- Protokol sinkronisasi dan aturan kunci ada di `packages/shared/src/apikey.ts`.
