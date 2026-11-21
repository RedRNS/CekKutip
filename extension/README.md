# Ekstensi browser CekKutip

Memeriksa daftar pustaka langsung dari browser, tanpa membuka situs. Ini alat yang sama dengan situs CekKutip: referensi dikirim ke server CekKutip, dicari di Crossref, OpenAlex, dan DataCite, lalu diberi satu verdict oleh aturan tetap (bukan oleh AI). Verdict adalah ajakan memeriksa, bukan tuduhan.

Untuk Chrome dan Edge versi 127 ke atas (Manifest V3, memakai API panel samping). Brave, Firefox, dan Safari belum diuji.

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

- **Klik ikon CekKutip.** Sebuah **panel samping** terbuka di sebelah halaman. Tempel referensi, lalu pilih **Check references**. Hasilnya sama seperti di situs: verdict, bukti, dan referensi yang dikoreksi (APA 7) untuk `Mismatch`. Panel tetap terbuka saat kamu mengklik halaman atau pindah tab, jadi pemeriksaan yang sedang berjalan tidak terputus. Lebarnya bisa kamu geser. Tutup dengan tombol tutup panel.
- **Pilih teks di halaman web mana pun, klik kanan, lalu pilih "Check selection with CekKutip".** Teksnya dimasukkan ke panel samping (menggantikan isi kotaknya; hasil di layar dan pemeriksaan yang berjalan tidak disentuh). **Belum ada yang dikirim** sampai kamu memilih Check references. Kalau browser tidak mau membuka panel sendiri, ikon menampilkan tanda "1": klik ikonnya.
- **Isi kotak otomatis dari teks yang kamu blok (opsional).** Di bagian atas panel ada pengaturan **Fill the box when I select text on a page**. Mati secara bawaan. Saat kamu menyalakannya, browser meminta izin membaca teks yang kamu pilih di situs web. Setelah itu, teks yang kamu blok di halaman mana pun muncul sendiri di kotak References, tanpa salin dan tempel: satu kalimat atau satu referensi (satu atau dua kata, dan teks di kolom formulir, diabaikan). Teksmu sendiri di kotak tidak pernah ditimpa: pilihan baru ditawarkan lewat pemberitahuan dengan tombol Add, Replace, atau Ignore. Matikan pengaturannya dan izinnya dicabut. Tidak berjalan di penampil PDF bawaan, halaman toko ekstensi, dan halaman internal browser.
- Bahasa: tombol **EN | ID** di panel.

## Kunci Gemini milikmu sendiri

Secara bawaan, pembacaan referensi memakai kunci Gemini bersama milik situs, yang punya batas harian. Kalau banyak orang memakainya, jatah itu bisa habis. Kamu bisa memakai kunci gratismu sendiri:

1. Buat kunci di https://aistudio.google.com/apikey.
2. Di panel, buka **Use your own Gemini API key (optional)**, tempel kuncinya, lalu **Save key**.

**Kunci dibagi otomatis dengan situs CekKutip.** Simpan di ekstensi, dan situs mengenalinya begitu dibuka di browser yang sama. Simpan atau hapus di situs, dan ekstensi mengikutinya. Perubahan terakhir yang menang, dan penghapusan ikut tersampaikan. Sinkronisasi ini hanya terjadi di satu browser pada satu perangkat: kunci tidak dikirim ke akun Google atau ke perangkat lain.

Kalau Google menolak kuncinya, atau jatahnya habis, hasil tetap keluar (dibaca oleh pembaca tanpa AI) dan ada pemberitahuan yang menjelaskannya.

## Izin yang diminta, dan alasannya

| Izin                           | Untuk apa                                                                                                                                                                                     |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storage`                      | Menyimpan kunci Gemini milikmu di perangkatmu, dan teks pilihan yang menunggu panel.                                                                                                          |
| `contextMenus`                 | Item klik kanan "Check selection with CekKutip".                                                                                                                                              |
| `sidePanel`                    | Menampilkan panel milik ekstensi ini. Tidak memberi akses ke halaman web mana pun.                                                                                                            |
| `scripting`                    | Memasang skrip pembaca pilihan ke halaman web, hanya setelah kamu menyalakan pengaturan isi otomatis dan mengizinkannya. Tidak menampilkan peringatan sendiri.                                |
| Semua situs web (**opsional**) | Tidak diminta saat memasang. Diminta browser hanya saat kamu menyalakan "Fill the box when I select text on a page", untuk membaca teks yang kamu pilih. Dikembalikan saat kamu mematikannya. |
| Akses ke situs CekKutip saja   | Panel memanggil API CekKutip, dan satu skrip kecil di halaman CekKutip membagi kunci dengan situs.                                                                                            |

Secara bawaan tidak ada akses ke tab lain, riwayat, cookie, atau situs lain. Kecuali kamu menyalakan pengaturan isi otomatis, ekstensi tidak membaca isi halaman yang kamu kunjungi: yang diterimanya hanya teks yang kamu pilih lalu klik kanan.

## Privasi

- Teks referensi dikirim ke server CekKutip **hanya saat kamu memilih Check references**, dengan aturan privasi yang sama seperti situs: tidak disimpan, tidak masuk log.
- Kunci Gemini disimpan di browsermu (`chrome.storage.local`, tidak disinkronkan lewat akun Google). Kunci dikirim ke server CekKutip dalam satu header pada setiap pemeriksaan yang memakai pembaca AI, dipakai hanya untuk meminta Google membaca referensimu, dan tidak pernah disimpan atau dicatat di log (dibuktikan tes).
- Memilih "Do not send my text to an AI service" berarti kunci tidak dikirim sama sekali.
- Teks yang masuk lewat pengaturan isi otomatis hanya dikirim ke panel samping di browsermu, dan dibuang bila panel tertutup. Tidak ke server sampai kamu memilih Check references. Kode ekstensi hanya membaca teks yang dipilih, tidak riwayat, cookie, isi formulir, atau sisa halaman.

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

- `src/panel/`: panel samping. Memakai komponen yang sama dengan situs (`WorkbenchCore`), diarahkan ke server CekKutip, dan menerima teks dari klik kanan walau sedang terbuka.
- `src/bridge.ts` dan `src/bridge-core.ts`: skrip yang berjalan di halaman CekKutip dan membagi kunci. Logikanya (`bridge-core.ts`) murni dan diuji tanpa browser.
- `src/background.ts`, `src/menu.ts`, dan `src/open-panel.ts`: ikon yang membuka panel, item klik kanan, dan cadangan tab bila browser tidak punya panel samping.
- Protokol sinkronisasi dan aturan kunci ada di `packages/shared/src/apikey.ts`.
