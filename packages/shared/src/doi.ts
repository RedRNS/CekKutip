import { DOI_PATTERN } from './patterns.js'

const DOI_IN_TEXT = /10\.\d{4,9}\/[^\s"<>]+/i
const TRAILING = new Set(['.', ',', ';', ':', ')', ']', '}', '>', '"', "'", '’', '”'])
const OPENERS: Record<string, string> = { ')': '(', ']': '[', '}': '{' }

function stripTrailingPunctuation(s: string): string {
  let out = s
  while (out.length > 0) {
    const last = out[out.length - 1] as string
    if (!TRAILING.has(last)) break
    const opener = OPENERS[last]
    if (opener) {
      // Keep a closing bracket that balances an opening one inside the DOI, as in 10.1002/(SICI)1097-4571.
      const opens = out.split(opener).length - 1
      const closes = out.split(last).length - 1
      if (opens >= closes) break
    }
    out = out.slice(0, -1)
  }
  return out
}

/**
 * Clean a DOI as it appears in pasted text. Accepts "doi:10.x/y", "https://doi.org/10.x/y",
 * and bare DOIs. Returns null when the result is not a plausible DOI.
 */
export function normalizeDoi(input: string): string | null {
  let s = input.trim()
  s = s.replace(/^(?:https?:\/\/)?(?:dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '')
  if (s.includes('%')) {
    try {
      s = decodeURIComponent(s)
    } catch {
      /* leave undecoded */
    }
  }
  s = (s.split(/\s/)[0] ?? '').trim()
  s = stripTrailingPunctuation(s)
  return DOI_PATTERN.test(s) ? s : null
}

/** Find the first DOI inside free text. */
export function extractDoi(text: string): string | null {
  const m = DOI_IN_TEXT.exec(text)
  return m ? normalizeDoi(m[0]) : null
}
