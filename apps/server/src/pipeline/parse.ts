import { MIN_YEAR, ReferenceTypeSchema, normalizeDoi, normalizeText } from '@cekkutip/shared'
import type { ParsedReference } from '@cekkutip/shared'
import { z } from 'zod'
import type { GeminiClient, GeminiUsage } from '../clients/gemini.js'
import { parseWithRegex } from './regex-parse.js'

/**
 * Parse: the only stage that may use a language model, and only to read text into fields.
 * Whatever the model returns is validated with zod and checked against the reference text.
 * Output that does not pass is retried once on its own, then replaced by the regex parser.
 */

const ExtractionSchema = z.object({
  i: z.number().int(),
  authors: z.array(z.string()).max(60),
  hasEtAl: z.boolean(),
  year: z.number().int().nullable(),
  title: z.string().nullable(),
  venue: z.string().nullable(),
  volume: z.string().nullable(),
  issue: z.string().nullable(),
  pages: z.string().nullable(),
  doi: z.string().nullable(),
  type: ReferenceTypeSchema,
})

export interface ParseDeps {
  /** Without a client, or in regex mode, every reference is read by the regex parser. */
  gemini?: GeminiClient
  batchSize: number
  now?: () => Date
  onUsage?: (usage: GeminiUsage) => void
}

const blankToNull = (s: string | null): string | null => {
  const t = s?.trim() ?? ''
  return t === '' ? null : t
}

/** True when `piece` (normalized) appears in `haystack` (normalized) as whole words. */
function appearsIn(piece: string, haystack: string): boolean {
  const p = normalizeText(piece)
  return p === '' || ` ${haystack} `.includes(` ${p} `)
}

/**
 * Check one extraction against its reference text. The model may only copy what is written:
 * a DOI, title, venue, author, or year that is not in the text means the output cannot be trusted.
 * Returns null when it does not pass.
 */
export function validateExtraction(
  raw: unknown,
  text: string,
  now: Date = new Date(),
): ParsedReference | null {
  const parsed = ExtractionSchema.safeParse(raw)
  if (!parsed.success) return null
  const e = parsed.data
  const norm = normalizeText(text)

  if (e.year !== null && (e.year < MIN_YEAR || e.year > now.getFullYear() + 1)) return null
  if (e.year !== null && !text.includes(String(e.year))) return null

  let doi: string | null = null
  if (blankToNull(e.doi) !== null) {
    doi = normalizeDoi(e.doi as string)
    if (doi === null) return null // not shaped like a DOI
    if (!text.toLowerCase().includes(doi.toLowerCase())) return null // not written in the text
  }

  const title = blankToNull(e.title)
  if (title !== null && !appearsIn(title, norm)) return null
  const venue = blankToNull(e.venue)
  if (venue !== null && !appearsIn(venue, norm)) return null

  const authors = e.authors.map((a) => a.trim()).filter((a) => a !== '')
  if (!authors.every((a) => appearsIn(a, norm))) return null

  const volume = blankToNull(e.volume)
  const issue = blankToNull(e.issue)
  const pages = blankToNull(e.pages)
  if (volume !== null && !appearsIn(volume, norm)) return null
  if (issue !== null && !appearsIn(issue, norm)) return null
  if (pages !== null && !appearsIn(pages, norm)) return null

  return {
    raw: text,
    authors,
    hasEtAl: e.hasEtAl,
    year: e.year,
    title,
    venue,
    volume,
    issue,
    pages,
    doi,
    type: e.type,
    parseMode: 'llm',
  }
}

/** Read a batch of references. The result is in the same order as `refs`. */
export async function parseBatch(
  refs: string[],
  mode: 'llm' | 'regex',
  deps: ParseDeps,
): Promise<ParsedReference[]> {
  const now = deps.now?.() ?? new Date()
  const regex = (text: string) => parseWithRegex(text, { now })
  if (mode === 'regex' || !deps.gemini) return refs.map(regex)

  const gemini = deps.gemini
  const items = refs.map((text, i) => ({ i, text }))

  let first: unknown[]
  try {
    const res = await gemini.extract(items)
    deps.onUsage?.(res.usage)
    first = res.results
  } catch {
    // The model service is unavailable. Do not hammer it one reference at a time: use the regex parser.
    return refs.map(regex)
  }

  const byIndex = new Map<number, unknown>()
  for (const r of first) {
    const i = (r as { i?: unknown } | null)?.i
    if (typeof i === 'number' && !byIndex.has(i)) byIndex.set(i, r)
  }

  const out: ParsedReference[] = []
  for (const item of items) {
    let parsed = validateExtraction(byIndex.get(item.i), item.text, now)
    if (parsed === null) {
      // One retry on its own, as the brief asks, then the regex parser.
      try {
        const single = await gemini.extract([{ i: 0, text: item.text }])
        deps.onUsage?.(single.usage)
        parsed = validateExtraction(single.results[0], item.text, now)
      } catch {
        parsed = null
      }
    }
    out.push(parsed ?? regex(item.text))
  }
  return out
}
