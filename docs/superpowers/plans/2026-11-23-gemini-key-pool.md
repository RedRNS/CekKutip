# Kunci Gemini cadangan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Server memakai `GEMINI_API_KEY`, `GEMINI_API_KEY_2`, `GEMINI_API_KEY_3` berurutan, dan pindah ke kunci berikutnya saat satu kunci habis atau ditolak Google.

**Architecture:** Pembungkus `createGeminiPool(clients, opts)` yang juga berupa `GeminiClient`, jadi pipeline, `parse.ts`, dan rute tidak berubah. `wiring.ts` memilih: nol kunci tidak ada pembaca, satu kunci klien biasa (perilaku sekarang persis), dua kunci atau lebih kolam. Status "kunci ini baru gagal" disimpan di memori kolam.

**Tech Stack:** TypeScript, Express, `@google/genai` (lewat `createGeminiClient` yang sudah ada), vitest.

**Spec:** `docs/superpowers/specs/2026-11-23-gemini-key-pool-design.md`

## Global Constraints

- Model hanya mengekstrak field. Verdict, kandidat, penjelasan tidak berubah. Kegagalan layanan tidak pernah menjadi `suspect`.
- Kunci tidak disimpan, tidak masuk log, tidak muncul di respons, tidak ada di repo atau klien. Tes memakai kunci palsu. `.env` tidak dibaca atau di-commit.
- Pindah kunci hanya untuk `ServiceUnavailableError` berkode `rate_limited` atau `blocked`. Kode `timeout`, `network`, `server_error`, `bad_response` dilempar ulang apa adanya tanpa pindah dan tanpa menandai kunci.
- Kunci pengunjung (header `x-gemini-key`) tidak masuk kolam dan tidak pernah jatuh ke kunci server.
- Masa lewat kunci yang gagal: 5 menit, konstanta `GEMINI_KEY_COOLDOWN_MS`. Hanya di memori.
- Bila semua kunci gagal atau sedang dilewati, yang dilempar adalah galat **kunci pertama** (kunci 1) yang terakhir tercatat.
- Satu kunci saja: perilaku sama persis seperti sekarang (tanpa pembungkus, tanpa masa lewat).
- Kunci kosong atau spasi dianggap tidak ada. Nilai kembar digabung. `geminiApiKey` tetap ada dan sama dengan kunci pertama yang ada (harness `eval/` memakainya).
- Alur proyek: tes lulus, typecheck, lint, prettier bersih, commit tersendiri per tugas.

## Review Focus

- Kunci 1 pulih setelah masa lewat: kunci 1 dipakai lagi dan kunci 2 tidak. Tes: Task 2, "tries a failed key again once its cooldown has passed".
- Timeout atau 5xx pada kunci 1 tidak menghabiskan kunci 2 dan 3. Tes: Task 2, "does not move on for failures that are not the key's fault".
- `GEMINI_API_KEY` kosong tetapi `GEMINI_API_KEY_2` terisi: AI tersedia. Tes: Task 1, "uses a backup key when the first is missing".
- Dua nilai kunci sama atau satu kosong tidak membuat klien ganda atau klien tanpa kunci. Tes: Task 1, "skips blanks and merges repeats".
- Kunci pengunjung yang ditolak tidak jatuh ke kunci server. Tes: Task 3, "a person's own key never falls back to the server's keys".

---

### Task 1: Env membaca tiga kunci

**Files:**
- Modify: `apps/server/src/config/env.ts` (`Env`, `loadEnv`)
- Modify: `apps/server/src/config/limits.ts` (tambah konstanta)
- Test: `apps/server/test/config.test.ts`

**Interfaces:**
- Produces: `Env.geminiApiKeys: string[]` (urut `GEMINI_API_KEY`, `_2`, `_3`; kosong dibuang; kembar digabung, kemunculan pertama dipertahankan). `Env.geminiApiKey: string | undefined` tetap, sama dengan `geminiApiKeys[0]`. `export const GEMINI_KEY_COOLDOWN_MS = 5 * 60 * 1000` di `limits.ts`.

- [ ] **Step 1: Write the failing tests** di `config.test.ts` (describe baru "Gemini keys"):

```ts
it('reads the three keys in order', () => {
  const e = loadEnv({ GEMINI_API_KEY: 'a', GEMINI_API_KEY_2: 'b', GEMINI_API_KEY_3: 'c' })
  expect(e.geminiApiKeys).toEqual(['a', 'b', 'c'])
  expect(e.geminiApiKey).toBe('a')
})
it('skips blanks and merges repeats', () => {
  const e = loadEnv({ GEMINI_API_KEY: 'a', GEMINI_API_KEY_2: '  ', GEMINI_API_KEY_3: 'a' })
  expect(e.geminiApiKeys).toEqual(['a'])
})
it('uses a backup key when the first is missing', () => {
  const e = loadEnv({ GEMINI_API_KEY: '', GEMINI_API_KEY_2: 'b' })
  expect(e.geminiApiKeys).toEqual(['b'])
  expect(e.geminiApiKey).toBe('b')
})
it('has no keys at all by default', () => {
  expect(loadEnv({}).geminiApiKeys).toEqual([])
})
```

- [ ] **Step 2: Run** `npx vitest run apps/server/test/config.test.ts`. Expected: FAIL (`geminiApiKeys` undefined). Tes lama "treats blank keys as absent" tetap lulus.
- [ ] **Step 3: Implement** `geminiApiKeys` di `loadEnv` memakai pembantu `text()` yang ada dan `[...new Set(...)]`; `geminiApiKey: geminiApiKeys[0]`. Tambah `GEMINI_KEY_COOLDOWN_MS` di `limits.ts` dengan komentar satu baris.
- [ ] **Step 4: Run** tes yang sama. Expected: PASS.
- [ ] **Step 5: Commit** `git add apps/server/src/config apps/server/test/config.test.ts && git commit -m "Env: read GEMINI_API_KEY_2 and _3 as backup keys"`

---

### Task 2: Kolam kunci

**Files:**
- Create: `apps/server/src/clients/gemini-pool.ts`
- Test: `apps/server/test/gemini-pool.test.ts`

**Interfaces:**
- Consumes: `GeminiClient` dari `clients/gemini.ts`, `ServiceUnavailableError` dari `lib/http.ts`.
- Produces: `createGeminiPool(clients: GeminiClient[], opts: { cooldownMs: number; now?: () => number }): GeminiClient`. Melempar `Error` bila `clients` kosong. `now` bawaan `Date.now`.

Perilaku `extract(items)`: telusuri klien berurutan, lewati yang `now() < until`. Pada `ServiceUnavailableError` berkode `rate_limited` atau `blocked`: simpan `{ until: now() + cooldownMs, error }` untuk klien itu dan coba berikutnya. Kode lain: lempar ulang segera, tanpa menandai. Bila tak ada yang menjawab: lempar `error` tersimpan milik klien pertama (indeks 0). Galat yang bukan `ServiceUnavailableError` dilempar ulang segera.

- [ ] **Step 1: Write the failing tests** di `gemini-pool.test.ts`. Pembantu: `ok(tag)` (klien yang mencatat panggilan dan menjawab `{ results: [], usage: { inputTokens: 0, outputTokens: 0 } }`), `failing(code, status)` (seperti di `own-key.test.ts`), jam `let t = 0` dengan `now: () => t`, `COOL = 1000`. Tes (nama sebagai berikut, asersi di sampingnya):

```ts
it('uses the first key while it works')               // a dipanggil 1x, b 0x
it('moves to the next key when one is at its limit')  // a rate_limited -> b menjawab, hasil b dikembalikan
it('moves to the next key when one is refused')       // a blocked -> b menjawab
it.each(['timeout','network','server_error','bad_response'])(
  'does not move on for failures that are not the key\'s fault',
  // a gagal dengan kode itu -> rejects.toMatchObject({ code }), b dipanggil 0x, panggilan kedua tetap memanggil a (tidak ditandai)
)
it('skips a key that just failed, for the cooldown')  // t=0 a gagal -> b; t=COOL-1: a tidak dipanggil lagi (a=1x)
it('tries a failed key again once its cooldown has passed') // t=COOL: a dipanggil lagi dan menjawab; b tidak dipanggil
it('rethrows the first key\'s error when every key fails') // a rate_limited, b blocked, c rate_limited -> code rate_limited; lalu a blocked, b rate_limited -> code blocked
it('answers from memory, without calling anyone, while every key is cooling') // ulangi setelah gagal semua pada t sama -> jumlah panggilan tidak bertambah, galat sama
it('serves two requests at once while the first key is failing') // Promise.all dua extract: keduanya resolve, jawaban dari b
it('refuses an empty list')                           // expect(() => createGeminiPool([], opts)).toThrow()
```

- [ ] **Step 2: Run** `npx vitest run apps/server/test/gemini-pool.test.ts`. Expected: FAIL (modul belum ada).
- [ ] **Step 3: Implement** `createGeminiPool` sesuai perilaku di atas. Satu array status per klien; tidak ada logging dan tidak menyimpan apa pun selain `{ until, error }`.
- [ ] **Step 4: Run** tes yang sama. Expected: semua PASS.
- [ ] **Step 5: Commit** `git add apps/server/src/clients/gemini-pool.ts apps/server/test/gemini-pool.test.ts && git commit -m "Gemini key pool: move to the next key when one is at its limit or refused"`

---

### Task 3: Pasang kolam di wiring dan uji lewat rute

**Files:**
- Modify: `apps/server/src/wiring.ts`
- Test: `apps/server/test/gemini-pool.test.ts` (tes wiring), `apps/server/test/own-key.test.ts` (tes rute)

**Interfaces:**
- Consumes: `Env.geminiApiKeys`, `GEMINI_KEY_COOLDOWN_MS`, `createGeminiPool`, `createGeminiClient`.
- Produces: `buildGeminiReader(env: Pick<Env, 'geminiApiKeys' | 'geminiModel' | 'geminiTemperature'>, create?: (opts: GeminiOptions) => GeminiClient): GeminiClient | undefined` (nol kunci `undefined`; satu kunci klien dari `create` itu sendiri; dua atau lebih kolam dengan urutan kunci). `buildPipelineDeps` memakainya untuk `gemini`. `GeminiOptions` perlu diekspor dari `clients/gemini.ts` bila belum.

- [ ] **Step 1: Write the failing tests.** Di `gemini-pool.test.ts` (describe "buildGeminiReader"), dengan `create` berupa spy yang mengembalikan klien palsu per kunci:

```ts
it('has no reader without keys')                         // undefined
it('uses the client itself, not a pool, for one key')    // create dipanggil 1x dengan { apiKey: 'k1', model, temperature }; hasil toBe klien itu
it('builds one client per key, in order, for several')   // create dipanggil dengan k1, k2, k3 berurutan
it('answers from the second key when the first is at its limit') // klien k1 melempar rate_limited -> extract() mengembalikan jawaban k2
```

Di `own-key.test.ts` (describe baru "the server's reader with backup keys"), memakai `start`, `doneOf`, `parseModes`, `fakeFactory`, `failing` yang ada:

```ts
it('still reads with the AI when the first server key is at its limit')
// gemini: createGeminiPool([failing('rate_limited',429)(), fakeFactory().createGemini('k2')], { cooldownMs: 1000 })
// parseModes(list) == ['llm'], summary.aiIssue === null
it('finishes without the AI and says "quota" when every server key is at its limit')
// kolam dua klien rate_limited -> aiIssue 'quota', parseModes ['regex'], summary.checkFailed === 0
it("a person's own key never falls back to the server's keys")
// gemini: kolam yang mencatat panggilan; createGemini: failing('blocked',400); POST dengan KEY
// aiIssue 'rejected'; panggilan ke klien kolam == 0
```

- [ ] **Step 2: Run** `npx vitest run apps/server/test/gemini-pool.test.ts apps/server/test/own-key.test.ts`. Expected: FAIL (`buildGeminiReader` belum ada); tes rute yang hanya memakai `createGeminiPool` sudah bisa lulus, itu wajar.
- [ ] **Step 3: Implement** `buildGeminiReader` di `wiring.ts` dan ganti ekspresi `gemini:` di `buildPipelineDeps`. Ekspor `GeminiOptions` bila perlu.
- [ ] **Step 4: Run** dua berkas tes tadi. Expected: PASS. Lalu `npm test` (semua) dan `npm run typecheck`. Expected: hijau, 844 tes sebelumnya tetap lulus.
- [ ] **Step 5: Commit** `git add apps/server && git commit -m "Server reader: use backup Gemini keys when the first is at its limit"`

---

### Task 4: Konfigurasi, dokumen, dan pemeriksaan kunci

**Files:**
- Modify: `.env.example`, `render.yaml`, `docs/DEPLOY.md` (baris 8, 49, 51, 74, 88, 139), `README.md` (baris 362, 370), `docs/DECISIONS.md` (butir 138), `CLAUDE.md` (satu baris di "Larangan")
- Create: `scripts/smoke-gemini-keys.ts`

**Interfaces:**
- Consumes: `loadEnv().geminiApiKeys`, `createGeminiClient`, `ServiceUnavailableError`.

- [ ] **Step 1: Konfigurasi.** `.env.example`: tambah `GEMINI_API_KEY_2=` dan `GEMINI_API_KEY_3=` dengan satu baris komentar (cadangan, dari proyek Google Cloud yang berbeda). `render.yaml`: dua entri `sync: false` setelah `GEMINI_API_KEY`.
- [ ] **Step 2: Dokumen.** `DEPLOY.md` dan `README.md`: sebut kedua variabel baru; di `DEPLOY.md` jelaskan bahwa pada layanan Render yang **sudah ada** variabel ditambah manual di Environment (Blueprint hanya menanyakan saat dibuat), dan bahwa kunci cadangan harus dari proyek Google Cloud berbeda karena kuota dihitung per proyek. `DECISIONS.md` butir 138: aturan pindah kunci, masa lewat 5 menit, galat kunci pertama bila semua gagal, satu kunci tanpa pembungkus, kunci pengunjung tidak jatuh ke kunci server, dan permintaan pemilik produk (23 Nov 2026). `CLAUDE.md`: satu baris di "Larangan" yang menyebut kunci cadangan server (DECISIONS butir 138) dan bahwa kunci server juga tidak boleh disimpan, dicatat, atau dikirim ke klien.
- [ ] **Step 3: Skrip `scripts/smoke-gemini-keys.ts`** (dijalankan pemilik: `npx tsx --env-file=.env scripts/smoke-gemini-keys.ts`). Untuk tiap kunci di `loadEnv().geminiApiKeys`, panggil `createGeminiClient({ apiKey, model, temperature, retries: 0 }).extract` dengan satu referensi contoh dan cetak `kunci N dari M: ok | batas habis (rate_limited) | ditolak (blocked) | gagal (<kode>)`. Tidak pernah mencetak kunci atau pesan galat Google. Keluar dengan kode 1 bila ada yang tidak `ok`.
- [ ] **Step 4: Verifikasi** `npm run typecheck && npm run lint && npx prettier --check .env.example render.yaml docs README.md CLAUDE.md scripts/smoke-gemini-keys.ts && npm test`. Expected: semua bersih dan lulus. Pastikan `git diff` tidak memuat nilai kunci apa pun.
- [ ] **Step 5: Commit** `git add -A && git commit -m "Backup Gemini keys: config, docs, DECISIONS 138, and a per-key smoke script"`
