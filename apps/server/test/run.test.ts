import type { ReferenceResult, StreamEvent } from '@cekkutip/shared'
import { describe, expect, it, vi } from 'vitest'
import type { GeminiClient } from '../src/clients/gemini.js'
import { ServiceUnavailableError } from '../src/lib/http.js'
import { planBatches, runPipeline } from '../src/pipeline/run.js'
import { DEFAULT_OPTIONS, applyAblation } from '../src/pipeline/types.js'
import type { PipelineOptions } from '../src/pipeline/types.js'
import { fixtureText, ok, status, urlHas } from './helpers.js'
import type { Rule } from './helpers.js'
import {
  DOI,
  FAKE_JOURNAL,
  FIXTURE_RULES,
  REF_DATACITE,
  REF_FAKE_DOI,
  REF_OK,
  REF_WITH_DOI,
  REF_WRONG,
  THESIS,
  WALTERS_TITLE,
  world,
} from './world.js'

const regexOptions = (over: Partial<PipelineOptions> = {}): PipelineOptions => ({
  ...DEFAULT_OPTIONS,
  parseMode: 'regex',
  ...over,
})

async function check(
  references: string[],
  w = world(),
  options: PipelineOptions = regexOptions(),
  extra: { signal?: AbortSignal; concurrency?: number } = {},
) {
  const events: StreamEvent[] = []
  const summary = await runPipeline(
    {
      references,
      options,
      parseBatchSize: 8,
      retrievalConcurrency: extra.concurrency ?? 3,
      toolVersion: 'test',
      signal: extra.signal,
      onEvent: (e) => void events.push(e),
    },
    w.deps,
  )
  const results = events
    .filter((e): e is Extract<StreamEvent, { type: 'result' }> => e.type === 'result')
    .map((e) => e.result)
    .sort((a, b) => a.index - b.index)
  return { events, results, summary, w }
}

const only = async (ref: string, w = world(), options = regexOptions()) => {
  const { results } = await check([ref], w, options)
  return results[0] as ReferenceResult
}

describe('verdicts from recorded API responses', () => {
  it('Verified: a correct reference without a DOI is found by title search', async () => {
    const r = await only(REF_OK)
    expect(r).toMatchObject({ status: 'verified', reasons: ['verified_all_match'] })
    expect(r.record).toMatchObject({ source: 'crossref', doi: DOI, year: 2023 })
    expect(r.scores).toMatchObject({ title: 1, authors: 1, yearDiff: 0 })
  })

  it('Verified: the same reference with its DOI is found through the DOI', async () => {
    const w = world()
    const r = await only(REF_WITH_DOI, w)
    expect(r.status).toBe('verified')
    expect(w.calls.some((c) => c.url.includes('/works/10.1038'))).toBe(true)
    expect(w.calls.some((c) => c.url.includes('query.bibliographic'))).toBe(false)
  })

  it('Mismatch: right title and authors, wrong year and journal (read by a model)', async () => {
    const gemini: GeminiClient = {
      extract: async (items) => ({
        usage: { inputTokens: 0, outputTokens: 0 },
        results: items.map((it) => ({
          i: it.i,
          authors: ['Walters', 'Wilder'],
          hasEtAl: false,
          year: 2021,
          title: WALTERS_TITLE,
          venue: 'Nature Communications',
          volume: null,
          issue: null,
          pages: null,
          doi: null,
          type: 'journal_article',
        })),
      }),
    }
    const r = await only(REF_WRONG, world(FIXTURE_RULES, gemini), {
      ...DEFAULT_OPTIONS,
      parseMode: 'llm',
    })
    expect(r.status).toBe('mismatch')
    expect(r.reasons).toEqual(['mismatch_year', 'mismatch_venue'])
    expect(r.parsed.parseMode).toBe('llm')
    expect(r.record?.venue).toBe('Scientific Reports')
    const byField = Object.fromEntries(r.comparison.map((c) => [c.field, c.state]))
    expect(byField).toEqual({
      title: 'agree',
      authors: 'agree',
      year: 'differs',
      venue: 'differs',
      doi: 'not_cited',
    })
  })

  it('Suspect: a DOI that is registered nowhere', async () => {
    const r = await only(REF_FAKE_DOI)
    expect(r).toMatchObject({ status: 'suspect', reasons: ['suspect_doi_not_found'], record: null })
  })

  it('Out-of-index: a DOI that belongs to DataCite', async () => {
    const r = await only(REF_DATACITE)
    expect(r).toMatchObject({ status: 'out_of_index', reasons: ['out_of_index_other_registry'] })
  })

  it('Out-of-index: a thesis whose title is only similar to indexed works', async () => {
    const r = await only(THESIS)
    expect(r).toMatchObject({
      status: 'out_of_index',
      reasons: ['out_of_index_type'],
      record: null,
    })
    expect(r.parsed.type).toBe('thesis')
    expect(r.scores.title).toBeGreaterThan(0.6) // a near miss existed...
    expect(r.scores.title).toBeLessThan(0.9) // ...but it was not the same work
  })

  it('Suspect: the same title cited like a journal article, with no matching record', async () => {
    const r = await only(FAKE_JOURNAL)
    expect(r).toMatchObject({ status: 'suspect', reasons: ['suspect_no_record_journal'] })
  })

  it('Out-of-index: too little detail to search, and no request is made', async () => {
    const w = world()
    const r = await only('Doe. 2020.', w)
    expect(r).toMatchObject({ status: 'out_of_index', reasons: ['out_of_index_insufficient_data'] })
    expect(w.calls).toHaveLength(0)
  })

  it('consults OpenAlex only when no Crossref candidate reaches TAU_L', async () => {
    const w = world()
    await only(THESIS, w) // Crossref has a 0.7x candidate: no OpenAlex
    expect(w.calls.some((c) => c.url.includes('openalex'))).toBe(false)

    const w2 = world([
      {
        repeat: true,
        match: urlHas('query.bibliographic'),
        respond: () => ok({ message: { items: [] } }),
      },
      {
        repeat: true,
        match: urlHas('api.openalex.org'),
        respond: () => ok(fixtureText('openalex-search-walters.json')),
      },
    ])
    const r = await only(REF_OK, w2)
    expect(w2.calls.some((c) => c.url.includes('openalex'))).toBe(true)
    expect(r).toMatchObject({ status: 'verified', record: { source: 'openalex', doi: DOI } })
  })

  it('A2 (no OpenAlex): never calls OpenAlex', async () => {
    const w = world([
      {
        repeat: true,
        match: urlHas('query.bibliographic'),
        respond: () => ok({ message: { items: [] } }),
      },
    ])
    const r = await only(REF_OK, w, applyAblation(regexOptions(), 'a2'))
    expect(w.calls.some((c) => c.url.includes('openalex'))).toBe(false)
    expect(r.status).toBe('suspect')
  })

  it('A1 (no abstain): the thesis becomes Suspect', async () => {
    const r = await only(THESIS, world(), applyAblation(regexOptions(), 'a1'))
    expect(r.status).toBe('suspect')
  })
})

describe('service failures are never verdicts', () => {
  const down = (match: Rule['match']): Rule => ({ repeat: true, match, respond: () => status(503) })

  it('Crossref search down gives check_failed, not suspect', async () => {
    const w = world([down(urlHas('api.crossref.org'))])
    const r = await only(FAKE_JOURNAL, w)
    expect(r).toMatchObject({
      status: 'check_failed',
      reasons: ['check_failed_network'],
      record: null,
    })
    expect(w.errors).toEqual(['server_error'])
  })

  it('Crossref DOI lookup down gives check_failed even for a DOI that is fake', async () => {
    const r = await only(REF_FAKE_DOI, world([down(urlHas('api.crossref.org'))]))
    expect(r.status).toBe('check_failed')
  })

  it('doi.org down after Crossref says 404 gives check_failed, not suspect_doi_not_found', async () => {
    const r = await only(
      REF_FAKE_DOI,
      world([
        {
          repeat: true,
          match: urlHas('api.crossref.org/works/10.9999'),
          respond: () => status(404),
        },
        down(urlHas('doi.org/doiRA')),
      ]),
    )
    expect(r.status).toBe('check_failed')
  })

  it('OpenAlex down after Crossref found nothing gives check_failed, not suspect', async () => {
    const r = await only(
      FAKE_JOURNAL,
      world([
        {
          repeat: true,
          match: urlHas('query.bibliographic'),
          respond: () => ok({ message: { items: [] } }),
        },
        down(urlHas('api.openalex.org')),
      ]),
    )
    expect(r.status).toBe('check_failed')
  })

  it('a timeout gives check_failed', async () => {
    const r = await only(
      REF_OK,
      world([
        {
          repeat: true,
          match: () => true,
          respond: () => new DOMException('slow', 'TimeoutError'),
        },
      ]),
    )
    expect(r.status).toBe('check_failed')
  })

  it('a rate limit with a long Retry-After gives check_failed', async () => {
    const r = await only(
      REF_OK,
      world([
        {
          repeat: true,
          match: () => true,
          respond: () => status(429, '', { 'retry-after': '9999' }),
        },
      ]),
    )
    expect(r.status).toBe('check_failed')
  })

  it('doi.org saying Crossref holds a DOI that Crossref lacks gives check_failed (we cannot tell why)', async () => {
    const r = await only(
      REF_WITH_DOI,
      world([
        {
          repeat: true,
          match: urlHas('api.crossref.org/works/10.1038'),
          respond: () => status(404),
        },
        {
          repeat: true,
          match: urlHas('doi.org/doiRA'),
          respond: () => ok(fixtureText('doira-crossref.json')),
        },
      ]),
    )
    expect(r.status).toBe('check_failed')
  })

  it('an unexpected exception in a client is contained as check_failed, not thrown', async () => {
    const w = world()
    w.deps.retrieve.crossref.search = async () => {
      throw new TypeError('bug in a client')
    }
    const r = await only(REF_OK, w)
    expect(r.status).toBe('check_failed')
    expect(w.errors).toEqual(['internal'])
  })

  it('one failing reference does not affect the others', async () => {
    const w = world([
      // Only the Fabrication title search fails; everything else answers from fixtures.
      {
        repeat: true,
        match: (u) => u.includes('query.bibliographic') && u.includes('Fabrication'),
        respond: () => status(503),
      },
      ...FIXTURE_RULES,
    ])
    const { results, summary } = await check([REF_OK, THESIS, REF_FAKE_DOI], w)
    expect(results.map((r) => r.status)).toEqual(['check_failed', 'out_of_index', 'suspect'])
    expect(summary).toMatchObject({ checkFailed: 1, outOfIndex: 1, suspect: 1, total: 3 })
  })
})

describe('streaming and summary', () => {
  it('emits started first, then one result per reference, then done last', async () => {
    const { events, results } = await check([REF_OK, REF_FAKE_DOI, THESIS, 'Doe. 2020.'])
    expect(events[0]).toEqual({ type: 'started', total: 4 })
    expect(events.at(-1)?.type).toBe('done')
    expect(events.filter((e) => e.type === 'result')).toHaveLength(4)
    expect(results.map((r) => r.index)).toEqual([0, 1, 2, 3])
    expect(events.slice(1, -1).every((e) => e.type === 'result')).toBe(true)
  })

  it('counts every status in the summary and records the thresholds and tool version', async () => {
    const { summary } = await check([REF_OK, REF_FAKE_DOI, THESIS, 'Doe. 2020.', REF_WITH_DOI])
    expect(summary).toMatchObject({
      total: 5,
      verified: 2,
      mismatch: 0,
      suspect: 1,
      outOfIndex: 2,
      checkFailed: 0,
      toolVersion: 'test',
      thresholds: DEFAULT_OPTIONS.thresholds,
    })
    expect(summary.medianLatencyMs).toBeGreaterThanOrEqual(0)
    expect(
      summary.verified +
        summary.mismatch +
        summary.suspect +
        summary.outOfIndex +
        summary.checkFailed,
    ).toBe(summary.total)
  })

  it('emits results as they finish, not in input order', async () => {
    const slowThenFast = (): Rule[] => [
      { repeat: true, match: urlHas('api.crossref.org/works/10.9999'), respond: () => status(404) },
      {
        repeat: true,
        match: urlHas('doi.org/doiRA'),
        respond: () => ok(fixtureText('doira-notfound.json')),
      },
      {
        repeat: true,
        match: urlHas('query.bibliographic'),
        respond: async () => {
          await new Promise((r) => setTimeout(r, 60))
          return ok(fixtureText('crossref-search-walters.json'))
        },
      },
    ]
    const { events } = await check([REF_OK, REF_FAKE_DOI], world(slowThenFast()))
    const order = events
      .filter((e) => e.type === 'result')
      .map((e) => (e as { result: ReferenceResult }).result.index)
    expect(order).toEqual([1, 0]) // the DOI lookup (index 1) finishes before the slow title search (index 0)
  })

  it('never has more lookups in flight than the concurrency limit', async () => {
    let active = 0
    let peak = 0
    const w = world([
      {
        repeat: true,
        match: urlHas('query.bibliographic'),
        respond: async () => {
          active++
          peak = Math.max(peak, active)
          await new Promise((r) => setTimeout(r, 15))
          active--
          return ok(fixtureText('crossref-search-walters.json'))
        },
      },
    ])
    const refs = Array.from({ length: 10 }, (_, i) =>
      REF_OK.replace('(2023)', `(2023) ${'x'.repeat(i)}`),
    )
    await check(refs, w, regexOptions(), { concurrency: 3 })
    expect(peak).toBeLessThanOrEqual(3)
    expect(peak).toBeGreaterThan(1)
  })

  it('stops without a done event when the client goes away', async () => {
    const controller = new AbortController()
    const events: StreamEvent[] = []
    const w = world()
    const refs = Array.from({ length: 6 }, (_, i) => REF_OK.replace('13(1)', `13(${i + 1})`))
    await runPipeline(
      {
        references: refs,
        options: regexOptions(),
        parseBatchSize: 2,
        retrievalConcurrency: 1,
        toolVersion: 'test',
        signal: controller.signal,
        onEvent: (e) => {
          events.push(e)
          if (e.type === 'result') controller.abort()
        },
      },
      w.deps,
    )
    expect(events.some((e) => e.type === 'done')).toBe(false)
    expect(events.filter((e) => e.type === 'result').length).toBeLessThan(6)
  })

  it('works with an empty list', async () => {
    const { events, summary } = await check([])
    expect(events.map((e) => e.type)).toEqual(['started', 'done'])
    expect(summary.total).toBe(0)
  })
})

describe('T1 and T2: namesakes and reposts in Crossref', () => {
  const VASWANI =
    'Vaswani, A., Shazeer, N., & Polosukhin, I. (2017). Attention is all you need. Advances in Neural Information Processing Systems, 30.'
  const WHO =
    'World Health Organization. (2021). Obesity and overweight. https://www.who.int/news-room/fact-sheets/detail/obesity-and-overweight'

  const crossrefItems = (items: unknown[]) => ok({ message: { items } })
  const repost = {
    DOI: '10.65215/repost1',
    type: 'posted-content',
    title: ['Attention Is All You Need'],
    author: [
      { family: 'Vaswani', given: 'Ashish' },
      { family: 'Shazeer', given: 'Noam' },
      { family: 'Polosukhin', given: 'Illia' },
    ],
    issued: { 'date-parts': [[2025]] },
  }
  const original = {
    id: 'https://openalex.org/W1',
    doi: null,
    title: 'Attention is All you Need',
    publication_year: 2017,
    authorships: [
      { author: { display_name: 'Ashish Vaswani' } },
      { author: { display_name: 'Noam Shazeer' } },
      { author: { display_name: 'Illia Polosukhin' } },
    ],
    primary_location: {
      landing_page_url: 'https://example.org/attention',
      source: { display_name: 'Neural Information Processing Systems' },
    },
    biblio: { volume: '30' },
  }
  const namesake = {
    DOI: '10.1000/other-obesity',
    title: ['Obesity and overweight'],
    author: [{ family: 'Smith', given: 'Jo' }],
    issued: { 'date-parts': [[2005]] },
    'container-title': ['Some Medical Journal'],
  }

  it('T2: a repost in Crossref with the wrong year is overruled by a full match in OpenAlex', async () => {
    const w = world([
      {
        repeat: true,
        match: urlHas('query.bibliographic'),
        respond: () => crossrefItems([repost]),
      },
      {
        repeat: true,
        match: urlHas('api.openalex.org'),
        respond: () => ok({ results: [original] }),
      },
    ])
    const r = await only(VASWANI, w)
    expect(r).toMatchObject({ status: 'verified', record: { source: 'openalex', year: 2017 } })
    expect(w.calls.filter((c) => c.url.includes('openalex'))).toHaveLength(1)
  })

  it('T2: without a full match in OpenAlex the Crossref mismatch stands', async () => {
    const w = world([
      {
        repeat: true,
        match: urlHas('query.bibliographic'),
        respond: () => crossrefItems([repost]),
      },
      { repeat: true, match: urlHas('api.openalex.org'), respond: () => ok({ results: [] }) },
    ])
    const r = await only(VASWANI, w)
    expect(r).toMatchObject({
      status: 'mismatch',
      reasons: ['mismatch_year'],
      record: { source: 'crossref' },
    })
  })

  it('T2: if the second look fails, the first answer stands and the failure is reported as a code', async () => {
    const w = world([
      {
        repeat: true,
        match: urlHas('query.bibliographic'),
        respond: () => crossrefItems([repost]),
      },
      { repeat: true, match: urlHas('api.openalex.org'), respond: () => status(503) },
    ])
    const r = await only(VASWANI, w)
    expect(r.status).toBe('mismatch')
    expect(w.errors).toEqual(['second_look_server_error'])
  })

  it('T2: A2 (no OpenAlex) takes no second look', async () => {
    const w = world([
      {
        repeat: true,
        match: urlHas('query.bibliographic'),
        respond: () => crossrefItems([repost]),
      },
    ])
    const r = await only(VASWANI, w, applyAblation(regexOptions(), 'a2'))
    expect(r.status).toBe('mismatch')
    expect(w.calls.some((c) => c.url.includes('openalex'))).toBe(false)
  })

  it('T1: a web page whose title matches another work is abstained on, not called a mismatch', async () => {
    const w = world([
      {
        repeat: true,
        match: urlHas('query.bibliographic'),
        respond: () => crossrefItems([namesake]),
      },
      { repeat: true, match: urlHas('api.openalex.org'), respond: () => ok({ results: [] }) },
    ])
    const r = await only(WHO, w)
    expect(r).toMatchObject({
      status: 'out_of_index',
      reasons: ['out_of_index_type'],
      record: null,
    })
    expect(r.parsed.type).toBe('web_page')
    // The namesake triggers a second look in OpenAlex.
    expect(w.calls.some((c) => c.url.includes('openalex'))).toBe(true)
  })

  it('T1: among candidates, one with a cited author beats a namesake with a better title score', async () => {
    const real = {
      DOI: '10.1000/real-obesity',
      title: ['Obesity and overweight: fact sheet'],
      author: [{ name: 'World Health Organization' }],
      issued: { 'date-parts': [[2021]] },
    }
    const w = world([
      {
        repeat: true,
        match: urlHas('query.bibliographic'),
        respond: () => crossrefItems([namesake, real]),
      },
    ])
    const r = await only(WHO, w)
    expect(r).toMatchObject({ status: 'verified', record: { doi: '10.1000/real-obesity' } })
  })
})

describe('planBatches', () => {
  it.each([
    [0, 8, []],
    [1, 8, [1]],
    [8, 8, [8]],
    [9, 8, [5, 4]],
    [10, 8, [5, 5]],
    [16, 8, [8, 8]],
    [17, 8, [6, 6, 5]],
    [40, 8, [8, 8, 8, 8, 8]],
    [3, 1, [1, 1, 1]],
  ])('%i references with at most %i per batch', (total, max, sizes) => {
    const plan = planBatches(total, max)
    expect(plan.map((b) => b.size)).toEqual(sizes)
    expect(plan.every((b) => b.size <= max)).toBe(true)
    // Batches are contiguous and cover every reference exactly once.
    let next = 0
    for (const b of plan) {
      expect(b.start).toBe(next)
      next += b.size
    }
    expect(next).toBe(total)
  })
})

describe('parsing in the pipeline', () => {
  it('reads batches in parallel, at most three at a time, and keeps every reference in its place', async () => {
    let active = 0
    let peak = 0
    const sizes: number[] = []
    const gemini: GeminiClient = {
      extract: async (items) => {
        active++
        peak = Math.max(peak, active)
        sizes.push(items.length)
        await new Promise((r) => setTimeout(r, 30))
        active--
        // An empty answer makes every reference fall back to the regex parser after one retry.
        return { results: [], usage: { inputTokens: 0, outputTokens: 0 } }
      },
    }
    const refs = Array.from({ length: 34 }, (_, i) => `Doe. 20${String(i).padStart(2, '0')}.`)
    const { results } = await check(refs, world(FIXTURE_RULES, gemini), {
      ...DEFAULT_OPTIONS,
      parseMode: 'llm',
    })
    expect(sizes.filter((n) => n > 1)).toEqual([7, 7, 7, 7, 6]) // 34 references, five even batches
    expect(peak).toBeGreaterThan(1)
    expect(peak).toBeLessThanOrEqual(3)
    expect(results.map((r) => r.raw)).toEqual(refs)
  })

  it('falls back to the regex parser for every reference when the model service is down', async () => {
    const gemini: GeminiClient = {
      extract: vi.fn(async () => {
        throw new ServiceUnavailableError('gemini', 'server_error', 503)
      }),
    }
    const { results } = await check([REF_OK, THESIS], world(FIXTURE_RULES, gemini), {
      ...DEFAULT_OPTIONS,
      parseMode: 'llm',
    })
    expect(results.map((r) => r.parsed.parseMode)).toEqual(['regex', 'regex'])
    expect(results[0]?.status).toBe('verified')
    expect(gemini.extract).toHaveBeenCalledTimes(1)
  })

  it('uses the regex parser, and never the model, in regex mode', async () => {
    const gemini: GeminiClient = { extract: vi.fn() }
    await check([REF_OK], world(FIXTURE_RULES, gemini), regexOptions())
    expect(gemini.extract).not.toHaveBeenCalled()
  })

  it('A3 (regex instead of the model) flips the parse mode', () => {
    expect(applyAblation({ ...DEFAULT_OPTIONS, parseMode: 'llm' }, 'a3').parseMode).toBe('regex')
  })

  it('the language model has no say in the verdict: a model that answers "verified" changes nothing', async () => {
    const gemini: GeminiClient = {
      extract: async (items) => ({
        usage: { inputTokens: 0, outputTokens: 0 },
        results: items.map((it) => ({
          i: it.i,
          authors: ['Doe'],
          hasEtAl: false,
          year: 2022,
          title: 'A made-up article about nothing',
          venue: 'Journal of Nothing',
          volume: '1',
          issue: '1',
          pages: '1-2',
          doi: '10.9999/this-doi-does-not-exist-12345',
          type: 'journal_article',
          verdict: 'verified',
          exists: true,
        })),
      }),
    }
    const r = await only(REF_FAKE_DOI, world(FIXTURE_RULES, gemini), {
      ...DEFAULT_OPTIONS,
      parseMode: 'llm',
    })
    expect(r.status).toBe('suspect')
  })
})

describe('what the result exposes', () => {
  it('shows the record only when the verdict is about that record', async () => {
    const { results } = await check([REF_OK, REF_FAKE_DOI, THESIS, FAKE_JOURNAL])
    expect(results.map((r) => r.record !== null)).toEqual([true, false, false, false])
  })

  it('reports not_found for every field when no record is shown', async () => {
    const r = await only(THESIS)
    expect(r.comparison.find((c) => c.field === 'title')).toMatchObject({
      state: 'not_found',
      found: null,
    })
    expect(r.comparison.every((c) => c.found === null)).toBe(true)
  })

  it('keeps the original text and the reasons as codes only (no prose)', async () => {
    const r = await only(REF_OK)
    expect(r.raw).toBe(REF_OK)
    expect(r.reasons.every((c) => /^[a-z_]+$/.test(c))).toBe(true)
  })
})
