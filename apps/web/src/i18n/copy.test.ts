import { describe, expect, it } from 'vitest'
import { en } from './en'
import { id } from './id'

function collect(value: unknown, path: string, out: { path: string; text: string }[]) {
  if (typeof value === 'string') out.push({ path, text: value })
  else if (Array.isArray(value)) value.forEach((v, i) => collect(v, `${path}[${i}]`, out))
  else if (value && typeof value === 'object')
    for (const [k, v] of Object.entries(value)) collect(v, `${path}.${k}`, out)
}

const strings = (dict: unknown) => {
  const out: { path: string; text: string }[] = []
  collect(dict, '', out)
  return out
}

/** Words the brief bans in UI copy. "plagiarism" is allowed only in the required "does not do" list. */
const BANNED = [
  /\bfake\b/i,
  /\bfraud/i,
  /\bcheat/i,
  /\bliar\b/i,
  /\bpalsu\b/i,
  /\bcurang/i,
  /supercharge/i,
  /seamless/i,
  /\bunlock/i,
  /revolutioniz/i,
  /\bmagic/i,
  /\bpowerful\b/i,
  /cutting-edge/i,
  /AI-powered/i,
  /^welcome to/i,
]
const EMOJI = /\p{Extended_Pictographic}/u

describe.each([
  ['en', en],
  ['id', id],
])('copy deck (%s)', (_name, dict) => {
  const all = strings(dict)

  it('contains no banned words', () => {
    for (const { path, text } of all) {
      for (const re of BANNED) expect(text, `${path} matches ${re}`).not.toMatch(re)
    }
  })

  it('contains no emoji', () => {
    for (const { path, text } of all) expect(text, path).not.toMatch(EMOJI)
  })

  it('mentions plagiarism only in the "does not do" list', () => {
    for (const { path, text } of all) {
      if (/plagiari/i.test(text)) expect(path).toMatch(/^\.home\.notItems/)
    }
  })

  it('never accuses: no "misconduct" outside the disclaimer sentences', () => {
    for (const { path, text } of all) {
      if (/misconduct|pelanggaran/i.test(text)) {
        expect(path).toMatch(/statement|limits|notItems/)
      }
    }
  })
})

describe('copy deck parity', () => {
  it('has the same keys in both languages', () => {
    const keys = (d: unknown) => strings(d).map((s) => s.path)
    expect(keys(id)).toEqual(keys(en))
  })

  it('keeps verdict names untranslated', () => {
    for (const k of ['verified', 'mismatch', 'suspect', 'out_of_index'] as const) {
      expect(id.verdict[k]).toBe(en.verdict[k])
    }
  })

  it('keeps reason placeholders intact in both languages', () => {
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',')
    for (const k of Object.keys(en.reasons) as (keyof typeof en.reasons)[]) {
      expect(ph(id.reasons[k]), k).toBe(ph(en.reasons[k]))
    }
  })
})
