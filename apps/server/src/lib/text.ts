/** Remove JATS/HTML markup that Crossref and OpenAlex sometimes leave in titles, and decode basic entities. */
export function cleanMarkup(input: string): string {
  return input
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** First non-empty string of a value that may be a string, an array of strings, or missing. */
export function firstString(value: unknown): string | null {
  const v = Array.isArray(value) ? value[0] : value
  if (typeof v !== 'string') return null
  const s = cleanMarkup(v)
  return s === '' ? null : s
}

/** Volume, issue and similar fields: accept strings or numbers. */
export function asText(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'string') {
    const s = value.trim()
    return s === '' ? null : s
  }
  return null
}
