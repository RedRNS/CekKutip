import { describe, expect, it } from 'vitest'
import { createDataciteClient, mapDataciteDoc } from '../src/clients/datacite.js'
import { RetrievalCache } from '../src/lib/cache.js'
import { ServiceUnavailableError } from '../src/lib/http.js'
import { Scheduler } from '../src/lib/scheduler.js'
import { fixtureJson, fixtureText, ok, status, stubFetch, testHttp } from './helpers.js'

const ARXIV = '10.48550/arXiv.1706.03762'

function setup(rules: Parameters<typeof stubFetch>[0], mailto?: string) {
  const { fetchImpl, calls } = stubFetch(rules)
  const client = createDataciteClient({
    http: testHttp(fetchImpl),
    mailto,
    cache: new RetrievalCache(),
    scheduler: new Scheduler({ maxConcurrent: 5, minIntervalMs: 0 }),
  })
  return { client, calls }
}

describe('mapDataciteDoc', () => {
  it('maps an arXiv preprint: title, family names, full names, year, no venue', () => {
    const r = mapDataciteDoc(fixtureJson('datacite-arxiv-vaswani.json'))
    expect(r).toMatchObject({
      source: 'datacite',
      doi: '10.48550/arxiv.1706.03762',
      url: 'https://arxiv.org/abs/1706.03762',
      title: 'Attention Is All You Need',
      year: 2017,
      venue: null, // "arXiv" is the publisher, not a venue
      volume: null,
      issue: null,
      pages: null,
    })
    expect(r?.authors.slice(0, 3)).toEqual(['Vaswani', 'Shazeer', 'Parmar'])
    expect(r?.authorsFull?.slice(0, 2)).toEqual(['Ashish Vaswani', 'Noam Shazeer'])
  })

  it('maps a Zenodo record whose container has no title', () => {
    const r = mapDataciteDoc(fixtureJson('datacite-zenodo.json'))
    expect(r).toMatchObject({ source: 'datacite', year: 1902, venue: null })
    expect(r?.title).toMatch(/^PLATE X\./)
    expect(r?.url).toBe('https://zenodo.org/record/3233821')
  })

  it('uses container title, volume, issue and pages when present, and organisations by name', () => {
    const r = mapDataciteDoc({
      data: {
        attributes: {
          doi: '10.1234/abc',
          titles: [{ title: 'A <i>study</i> of things' }],
          creators: [
            { name: 'World Health Organization', nameType: 'Organizational' },
            { name: 'Lee, Min', givenName: 'Min', familyName: 'Lee', nameType: 'Personal' },
          ],
          publicationYear: 2020,
          container: {
            title: 'Journal of Things',
            volume: '4',
            issue: 2,
            firstPage: '10',
            lastPage: '19',
          },
        },
      },
    })
    expect(r).toMatchObject({
      title: 'A study of things',
      authors: ['World Health Organization', 'Lee'],
      authorsFull: ['World Health Organization', 'Min Lee'],
      venue: 'Journal of Things',
      volume: '4',
      issue: '2',
      pages: '10-19',
      url: 'https://doi.org/10.1234/abc', // no url attribute: fall back to the DOI link
    })
  })

  it('accepts a publication year given as a string and rejects nonsense', () => {
    const doc = (publicationYear: unknown) => ({
      data: { attributes: { titles: [{ title: 'T' }], publicationYear } },
    })
    expect(mapDataciteDoc(doc('2019'))?.year).toBe(2019)
    expect(mapDataciteDoc(doc('n.d.'))?.year).toBeNull()
    expect(mapDataciteDoc(doc(null))?.year).toBeNull()
  })

  it('returns null without a usable title or with the wrong shape', () => {
    expect(mapDataciteDoc({ data: { attributes: { titles: [] } } })).toBeNull()
    expect(mapDataciteDoc({ data: { attributes: { titles: [{ title: '  ' }] } } })).toBeNull()
    expect(mapDataciteDoc({ errors: [] })).toBeNull()
    expect(mapDataciteDoc('<html>')).toBeNull()
    expect(mapDataciteDoc(null)).toBeNull()
  })
})

describe('createDataciteClient.getByDoi', () => {
  it('returns the record and calls the DataCite DOI endpoint with the DOI path-encoded', async () => {
    const { client, calls } = setup([
      { match: () => true, respond: () => ok(fixtureText('datacite-arxiv-vaswani.json')) },
    ])
    const found = await client.getByDoi(ARXIV)
    expect(found).toMatchObject({ found: true, record: { title: 'Attention Is All You Need' } })
    expect(calls[0]?.url).toBe(`https://api.datacite.org/dois/${ARXIV}`)
  })

  it('resolves 404 to not found', async () => {
    const { client } = setup([
      { match: () => true, respond: () => status(404, fixtureText('datacite-404.json')) },
    ])
    expect(await client.getByDoi('10.9999/none')).toEqual({ found: false })
  })

  it('throws ServiceUnavailableError on a malformed 200, never a "not found"', async () => {
    const { client } = setup([{ match: () => true, respond: () => ok({ data: {} }) }])
    await expect(client.getByDoi(ARXIV)).rejects.toMatchObject({
      service: 'datacite',
      code: 'bad_response',
    })
  })

  it('throws ServiceUnavailableError when the service keeps failing', async () => {
    const { client, calls } = setup([
      { repeat: true, match: () => true, respond: () => status(503) },
    ])
    await expect(client.getByDoi(ARXIV)).rejects.toBeInstanceOf(ServiceUnavailableError)
    expect(calls.length).toBeGreaterThan(1) // retried first
  })

  it('caches by DOI, ignoring case, so a repeated DOI costs one request', async () => {
    const { client, calls } = setup([
      {
        repeat: true,
        match: () => true,
        respond: () => ok(fixtureText('datacite-arxiv-vaswani.json')),
      },
    ])
    await client.getByDoi(ARXIV)
    await client.getByDoi(ARXIV.toLowerCase())
    expect(calls).toHaveLength(1)
  })

  it('puts the contact address only in the User-Agent, never in the URL', async () => {
    const { client, calls } = setup(
      [{ match: () => true, respond: () => ok(fixtureText('datacite-zenodo.json')) }],
      'team@example.org',
    )
    await client.getByDoi('10.5281/zenodo.3233821')
    expect(calls[0]?.url).not.toContain('team@example.org')
    expect((calls[0]?.init?.headers as Record<string, string>)['user-agent']).toBe(
      'CekKutip/0.1 (mailto:team@example.org)',
    )
  })

  it('sends the generic User-Agent when no address is configured', async () => {
    const { client, calls } = setup([
      { match: () => true, respond: () => ok(fixtureText('datacite-zenodo.json')) },
    ])
    await client.getByDoi('10.5281/zenodo.3233821')
    expect((calls[0]?.init?.headers as Record<string, string>)['user-agent']).toBe('CekKutip')
  })
})
