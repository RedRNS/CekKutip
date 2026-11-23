import { describe, expect, it } from 'vitest'
import {
  createGarudaClient,
  garudaTitleVariants,
  parseGarudaAuthor,
  parseGarudaPage,
  parseJournalLine,
} from '../src/clients/garuda.js'
import { RetrievalCache } from '../src/lib/cache.js'
import { ServiceUnavailableError } from '../src/lib/http.js'
import { Scheduler } from '../src/lib/scheduler.js'
import { fixtureText, ok, status, stubFetch, testHttp } from './helpers.js'

const instant = () => new Scheduler({ maxConcurrent: 5, minIntervalMs: 0 })
const BASE = 'https://garuda.kemdiktisaintek.go.id'

describe('parseGarudaPage on recorded pages', () => {
  it('reads the Wantoro article, the one Crossref and OpenAlex do not have', () => {
    const page = parseGarudaPage(fixtureText('garuda-search-wantoro.html'))
    expect(page.total).toBe(1)
    expect(page.records).toEqual([
      {
        source: 'garuda',
        doi: null,
        url: `${BASE}/documents/detail/5105249`,
        title:
          'Evaluasi Kinerja Algoritma Machine Learning (ML) Menggunakan Seleksi Fitur pada Klasifikasi Diabetes',
        authors: ['Wantoro', 'Zulkifli', 'Fitria Yulia', 'Yana Ayu', 'Mustofa'],
        authorsFull: [
          'Agus Wantoro',
          'Zulkifli',
          'Aviv Fitria Yulia',
          'Dwi Yana Ayu',
          'Syazili Mustofa',
        ],
        year: 2025,
        venue: 'Jurnal Informatika Polinema',
        volume: '11',
        issue: '3',
        pages: null,
      },
    ])
  })

  it('says "found 0 documents" as zero records, which is an answer and not an error', () => {
    expect(parseGarudaPage(fixtureText('garuda-search-nomatch.html'))).toEqual({
      total: 0,
      records: [],
    })
  })

  it('reads a page of ten results of different shapes', () => {
    const page = parseGarudaPage(fixtureText('garuda-search-many.html'))
    expect(page.total).toBe(5613) // "5,613 documents": the thousands separator is not a decimal point
    const byUrl = (id: number) => page.records.filter((r) => r.url === `${BASE}/documents/detail/${id}`)

    // Three kinds of venue line: "(2019): Desember 2019", "... || repeated name", and a year outside brackets.
    expect(byUrl(1979898)[0]).toMatchObject({
      venue: 'Jurnal RESTI (Rekayasa Sistem dan Teknologi Informasi)',
      volume: '3',
      issue: '3',
      year: 2019,
      authors: ['Aaputra', 'Rosiyadi', 'Gata', 'Husain'], // names without a comma: the last word
    })
    expect(byUrl(3105654)[0]).toMatchObject({
      venue: 'Algoritme Jurnal Mahasiswa Teknik Informatika',
      volume: '3',
      issue: '1',
      year: 2022,
      authors: ['Yolanda', 'Santi', 'Permadi'], // names with a comma: the part before it
    })
    expect(byUrl(4755225)[0]).toMatchObject({
      venue: 'Bulletin of Information Technology (BIT)',
      volume: '5',
      issue: '4',
      year: 2024,
    })
  })

  it('removes the keyword that Garuda puts in front of a title, and keeps the original too', () => {
    const page = parseGarudaPage(fixtureText('garuda-search-many.html'))
    const titles = page.records
      .filter((r) => r.url?.endsWith('/1979898'))
      .map((r) => r.title)
    expect(titles).toEqual([
      'Analisis Sentimen E-Wallet Pada Google Play Menggunakan Algoritma Naive Bayes Berbasis Particle Swarm Optimization',
      'Analisis Sentimen Analisis Sentimen E-Wallet Pada Google Play Menggunakan Algoritma Naive Bayes Berbasis Particle Swarm Optimization',
    ])
    // A keyword list followed by a comma cannot be told apart from a title, so it is left alone.
    expect(
      page.records.filter((r) => r.url?.endsWith('/3285150')).map((r) => r.title),
    ).toEqual([
      'Analisis Sentimen, Text Mining Penerapan Analisis Sentimen Dan Naive Bayes Terhadap Opini Penggunaan Kendaraan Listrik Di Twitter',
    ])
  })
})

describe('parseGarudaPage refuses a page it does not understand', () => {
  const item = (title: string) =>
    `<div class="article-item"><a class="title-article" href="/documents/detail/7"><xmp>${title}</xmp></a>` +
    `<xmp class="subtitle-article"> Jurnal X Vol 1 No 1 (2020) </xmp></div>`

  it('throws bad_response when the "Found N documents" marker is missing', () => {
    // Not "no results": the site may have changed, or an error page came back with status 200.
    expect(() => parseGarudaPage('<html><body>Terjadi kesalahan</body></html>')).toThrow(
      ServiceUnavailableError,
    )
    try {
      parseGarudaPage('<html>maintenance</html>')
    } catch (e) {
      expect(e).toMatchObject({ service: 'garuda', code: 'bad_response' })
    }
  })

  it('throws when the marker says there are results but none can be read', () => {
    expect(() => parseGarudaPage('<h2>Found 3 documents</h2><div class="card">x</div>')).toThrow(
      ServiceUnavailableError,
    )
  })

  it('throws when a result has no title, instead of skipping it', () => {
    const page = `<h2>Found 2 documents</h2>${item('A study of things')}<div class="article-item">broken</div>`
    expect(() => parseGarudaPage(page)).toThrow(ServiceUnavailableError)
  })

  it('reads a well-formed page', () => {
    const page = parseGarudaPage(`<h2>Found 1 documents</h2>${item('A study of things ')}`)
    expect(page.records.map((r) => r.title)).toEqual(['A study of things'])
  })
})

describe('parseJournalLine', () => {
  it.each([
    [
      'Jurnal Informatika Polinema Vol. 11 No. 3 (2025): Vol. 11 No. 3 (2025)',
      { venue: 'Jurnal Informatika Polinema', volume: '11', issue: '3', year: 2025 },
    ],
    [
      'Algoritme Jurnal Mahasiswa Teknik Informatika Vol 3 No 1 (2022): Oktober 2022 || Algoritme Jurnal Mahasiswa Teknik Informatika',
      {
        venue: 'Algoritme Jurnal Mahasiswa Teknik Informatika',
        volume: '3',
        issue: '1',
        year: 2022,
      },
    ],
    [
      'Bulletin of Information Technology (BIT) Vol 5 No 4: Desember 2024',
      { venue: 'Bulletin of Information Technology (BIT)', volume: '5', issue: '4', year: 2024 },
    ],
    [
      'J-INTECH (Journal of Information and Technology) Vol 12 No 02 (2024): J-Intech',
      {
        venue: 'J-INTECH (Journal of Information and Technology)',
        volume: '12',
        issue: '02',
        year: 2024,
      },
    ],
    ['Jurnal X Vol 4 (2020): Edisi Khusus', { venue: 'Jurnal X', volume: '4', issue: null, year: 2020 }],
    ['Jurnal X No 2 (2020)', { venue: 'Jurnal X', volume: null, issue: '2', year: 2020 }],
    [
      'Prosiding Seminar Nasional (2019)',
      { venue: 'Prosiding Seminar Nasional', volume: null, issue: null, year: 2019 },
    ],
    ['Jurnal Y', { venue: 'Jurnal Y', volume: null, issue: null, year: null }],
    ['  ', { venue: null, volume: null, issue: null, year: null }],
  ])('%s', (line, expected) => {
    expect(parseJournalLine(line)).toEqual(expected)
  })
})

describe('parseGarudaAuthor', () => {
  it.each([
    ['Yolanda, Nedya', { family: 'Yolanda', full: 'Nedya Yolanda' }],
    ['Fitria Yulia, Aviv', { family: 'Fitria Yulia', full: 'Aviv Fitria Yulia' }],
    ['Suwanda Aditya Aaputra', { family: 'Aaputra', full: 'Suwanda Aditya Aaputra' }],
    ['Zulkifli', { family: 'Zulkifli', full: 'Zulkifli' }],
    ['  Wantoro,   Agus ', { family: 'Wantoro', full: 'Agus Wantoro' }],
  ])('%s', (name, expected) => {
    expect(parseGarudaAuthor(name)).toEqual(expected)
  })

  it('gives nothing for an empty name', () => {
    expect(parseGarudaAuthor('   ')).toBeNull()
    expect(parseGarudaAuthor(',')).toBeNull()
  })
})

describe('garudaTitleVariants', () => {
  it('drops a keyword phrase that comes back later in the title, and keeps the original second', () => {
    const polluted = 'Analisis Sentimen Analisis Sentimen E-Wallet Pada Google Play'
    expect(garudaTitleVariants(polluted)).toEqual([
      'Analisis Sentimen E-Wallet Pada Google Play',
      polluted,
    ])
    const lower = 'sistem pakar APLIKASI SISTEM PAKAR DIAGNOSA PENYAKIT BALITA'
    expect(garudaTitleVariants(lower)).toEqual(['APLIKASI SISTEM PAKAR DIAGNOSA PENYAKIT BALITA', lower])
  })

  it('leaves a clean title alone', () => {
    const t = 'Evaluasi Kinerja Algoritma Machine Learning (ML) Menggunakan Seleksi Fitur'
    expect(garudaTitleVariants(t)).toEqual([t])
  })

  it('leaves alone a title whose first words are followed by punctuation (a keyword list)', () => {
    const t = 'Analisis Sentimen, Text Mining Penerapan Analisis Sentimen Dan Naive Bayes'
    expect(garudaTitleVariants(t)).toEqual([t])
  })

  it('does not strip a title down to almost nothing', () => {
    expect(garudaTitleVariants('Analisis Sentimen Analisis Sentimen')).toEqual([
      'Analisis Sentimen Analisis Sentimen',
    ])
  })

  it('keeps the original, so a real title that repeats its opening words can still match', () => {
    const real = 'Sistem Pakar Diagnosa Penyakit dengan Sistem Pakar Forward Chaining'
    const variants = garudaTitleVariants(real)
    expect(variants).toContain(real)
  })
})

describe('Garuda client', () => {
  const wantoro = () => ok(fixtureText('garuda-search-wantoro.html'))
  const nothing = () => ok(fixtureText('garuda-search-nomatch.html'))
  const T =
    'Evaluasi Kinerja Algoritma Machine Learning (ML) Menggunakan Seleksi Fitur Pada Klasifikasi Diabetes'

  function make(rules: Parameters<typeof stubFetch>[0], extra: { now?: () => number } = {}) {
    const { fetchImpl, calls } = stubFetch(rules)
    const client = createGarudaClient({
      http: testHttp(fetchImpl),
      cache: new RetrievalCache(),
      scheduler: instant(),
      ...extra,
    })
    return { client, calls }
  }

  it('searches the title field with the whole title, and asks for HTML', async () => {
    const { client, calls } = make([{ match: () => true, respond: wantoro }])
    const found = await client.searchTitle(T)
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ source: 'garuda', year: 2025 })

    const url = new URL(calls[0]?.url as string)
    expect(url.origin + url.pathname).toBe(`${BASE}/documents`)
    expect(url.searchParams.get('q')).toBe(T)
    expect(url.searchParams.get('select')).toBe('title')
    expect(url.searchParams.has('from')).toBe(false) // no year filter: a wrong year must still be found
    expect((calls[0]?.init?.headers as Record<string, string>).accept).toContain('text/html')
  })

  it('answers a second identical search from the cache', async () => {
    const { client, calls } = make([{ match: () => true, respond: wantoro }])
    await client.searchTitle(T)
    await client.searchTitle(T)
    expect(calls).toHaveLength(1)
  })

  it('tries the first six words when the whole title finds nothing (Garuda needs every word)', async () => {
    const { client, calls } = make([
      { match: (u) => new URL(u).searchParams.get('q') === T, respond: nothing },
      {
        match: (u) => new URL(u).searchParams.get('q') !== T,
        respond: wantoro,
      },
    ])
    const found = await client.searchTitle(T)
    expect(calls).toHaveLength(2)
    // Short words ("(ML)") and joining words ("pada", "dan") are left out of the second search.
    expect(new URL(calls[1]?.url as string).searchParams.get('q')).toBe(
      'evaluasi kinerja algoritma machine learning menggunakan',
    )
    expect(found).toHaveLength(1)
  })

  it('leaves out joining words when it shortens a title', async () => {
    const { client, calls } = make([{ match: () => true, respond: nothing, repeat: true }])
    await client.searchTitle('Pengaruh dan Peran Kepemimpinan pada Kinerja untuk Organisasi Publik Daerah')
    expect(new URL(calls[1]?.url as string).searchParams.get('q')).toBe(
      'pengaruh peran kepemimpinan kinerja organisasi publik',
    )
  })

  it('does not try again when the whole title already found something', async () => {
    const { client, calls } = make([{ match: () => true, respond: wantoro, repeat: true }])
    await client.searchTitle(T)
    expect(calls).toHaveLength(1)
  })

  it('does not try again for a title that is already six words or fewer', async () => {
    const { client, calls } = make([{ match: () => true, respond: nothing, repeat: true }])
    expect(await client.searchTitle('Dampak Media Sosial Prestasi Belajar')).toEqual([])
    expect(calls).toHaveLength(1)
  })

  it('returns an empty list when neither search finds anything', async () => {
    const { client, calls } = make([{ match: () => true, respond: nothing, repeat: true }])
    expect(await client.searchTitle(T)).toEqual([])
    expect(calls).toHaveLength(2)
  })

  it.each([
    ['403', () => status(403, 'Forbidden'), 'blocked'],
    ['500', () => status(500, 'oops'), 'server_error'],
    ['a page without the marker', () => ok('<html>Terjadi kesalahan</html>'), 'bad_response'],
    ['a 404', () => status(404, 'not found'), 'bad_response'],
  ])('fails with ServiceUnavailableError on %s, never with an empty answer', async (_n, respond, code) => {
    const { client } = make([{ match: () => true, respond, repeat: true }])
    await expect(client.searchTitle(T)).rejects.toMatchObject({ service: 'garuda', code })
    await expect(client.searchTitle(T)).rejects.toBeInstanceOf(ServiceUnavailableError)
  })

  it('does not cache a failure: after it clears, the next search asks again', async () => {
    let now = 0
    const { client, calls } = make(
      [
        { match: () => true, respond: () => status(500, 'oops'), repeat: false },
        { match: () => true, respond: () => status(500, 'oops'), repeat: false },
        { match: () => true, respond: () => status(500, 'oops'), repeat: false },
        { match: () => true, respond: wantoro },
      ],
      { now: () => now },
    )
    await expect(client.searchTitle(T)).rejects.toBeInstanceOf(ServiceUnavailableError)
    now = 61_000 // past the pause
    expect(await client.searchTitle(T)).toHaveLength(1)
    expect(calls.length).toBeGreaterThanOrEqual(4)
  })

  describe('pause after a failure', () => {
    it('stops asking Garuda for 60 seconds, answering at once with the same kind of failure', async () => {
      let now = 1_000
      const { client, calls } = make(
        [{ match: () => true, respond: () => status(403, 'Forbidden'), repeat: true }],
        { now: () => now },
      )
      await expect(client.searchTitle(T)).rejects.toMatchObject({ code: 'blocked' })
      const asked = calls.length

      now += 30_000
      await expect(client.searchTitle('Another title entirely about other things')).rejects.toMatchObject({
        service: 'garuda',
        code: 'blocked',
      })
      expect(calls).toHaveLength(asked) // no request went out
    })

    it('asks again once the pause is over', async () => {
      let now = 1_000
      const { client, calls } = make(
        [
          { match: () => true, respond: () => status(403, 'Forbidden') },
          { match: () => true, respond: nothing, repeat: true },
        ],
        { now: () => now },
      )
      await expect(client.searchTitle(T)).rejects.toBeInstanceOf(ServiceUnavailableError)
      now += 60_001
      expect(await client.searchTitle('Judul lain yang tidak ada')).toEqual([])
      expect(calls.length).toBeGreaterThan(1)
    })

    it('is not made longer by the requests it turns away', async () => {
      let now = 1_000
      const { client, calls } = make(
        [
          { match: () => true, respond: () => status(403, 'Forbidden') },
          { match: () => true, respond: nothing, repeat: true },
        ],
        { now: () => now },
      )
      await expect(client.searchTitle(T)).rejects.toBeInstanceOf(ServiceUnavailableError)
      now = 31_000 // inside the pause: turned away
      await expect(client.searchTitle('Judul kedua yang berbeda sama sekali')).rejects.toBeInstanceOf(
        ServiceUnavailableError,
      )
      now = 61_001 // 60 s after the real failure, not after the turned-away request
      expect(await client.searchTitle('Judul ketiga lagi')).toEqual([])
      expect(calls.length).toBeGreaterThan(1)
    })

    it('still answers from the cache during the pause', async () => {
      let now = 1_000
      const { client } = make(
        [
          { match: () => true, respond: wantoro },
          { match: () => true, respond: () => status(403, 'Forbidden'), repeat: true },
        ],
        { now: () => now },
      )
      expect(await client.searchTitle(T)).toHaveLength(1) // cached
      await expect(client.searchTitle('A different title that is not cached')).rejects.toBeInstanceOf(
        ServiceUnavailableError,
      )
      now += 5_000
      expect(await client.searchTitle(T)).toHaveLength(1) // the pause does not hide what is cached
    })
  })
})
