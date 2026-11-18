import type { CheckSummary, ReferenceResult } from '@cekkutip/shared'
import type { Dict } from '../i18n/en'

/** Replace {name} placeholders. Kept local so this module has no React dependency. */
function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? `{${k}}`))
}

/** The fixed sentences for a result, one per reason code. Text comes from templates only. */
export function reasonSentences(result: ReferenceResult, t: Dict): string[] {
  const source = result.record ? t.sources[result.record.source] : ''
  const n = result.scores.yearDiff ?? 0
  const type = t.types[result.parsed.type]
  return result.reasons.map((code) => fill(t.reasons[code], { source, n, type }))
}

export function reasonText(result: ReferenceResult, t: Dict): string {
  return reasonSentences(result, t).join(' ')
}

/**
 * One CSV cell. Quotes when needed, and neutralises cells that a spreadsheet would run as a formula
 * (leading =, +, -, @, tab, or carriage return), since the text comes from pasted references.
 */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  let s = String(value)
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}

/** Byte order mark: makes spreadsheet programs read the file as UTF-8. */
const BOM = String.fromCharCode(0xfeff)

const CSV_COLUMNS = [
  'no',
  'verdict',
  'reason_codes',
  'explanation',
  'reference',
  'cited_title',
  'cited_authors',
  'cited_year',
  'cited_venue',
  'cited_doi',
  'record_source',
  'record_title',
  'record_authors',
  'record_year',
  'record_venue',
  'record_doi',
  'record_url',
  'title_score',
  'authors_score',
  'year_difference',
  'venue_score',
  'read_by',
] as const

export function toCsv(results: ReferenceResult[], t: Dict): string {
  const rows = results.map((r) => {
    const p = r.parsed
    const rec = r.record
    return [
      r.index + 1,
      t.verdict[r.status],
      r.reasons.join(' '),
      reasonText(r, t),
      r.raw,
      p.title,
      p.authors.join('; ') + (p.hasEtAl ? ' et al.' : ''),
      p.year,
      p.venue,
      p.doi,
      rec ? t.sources[rec.source] : null,
      rec?.title,
      rec?.authors.join('; '),
      rec?.year,
      rec?.venue,
      rec?.doi,
      rec?.url,
      r.scores.title.toFixed(2),
      r.scores.authors.toFixed(2),
      r.scores.yearDiff,
      r.scores.venue.toFixed(2),
      p.parseMode,
    ]
      .map(csvCell)
      .join(',')
  })
  // A byte order mark makes spreadsheet programs read the file as UTF-8.
  return `${BOM}${[CSV_COLUMNS.join(','), ...rows].join('\r\n')}\r\n`
}

/** The totals sentence and the tool-and-cut-offs sentence, for the text report and the printout. */
export function summaryLines(summary: CheckSummary, t: Dict): { totals: string; tool: string } {
  return {
    totals: fill(t.report.totals, {
      total: summary.total,
      verified: summary.verified,
      mismatch: summary.mismatch,
      suspect: summary.suspect,
      outOfIndex: summary.outOfIndex,
      checkFailed: summary.checkFailed,
    }),
    tool: fill(t.report.tool, {
      version: summary.toolVersion,
      tauT: summary.thresholds.tauT,
      tauA: summary.thresholds.tauA,
      tauL: summary.thresholds.tauL,
      tauV: summary.thresholds.tauV,
    }),
  }
}

export function toReport(
  results: ReferenceResult[],
  summary: CheckSummary | null,
  t: Dict,
  date: string,
): string {
  const lines: string[] = [`${t.report.title} (${date})`, '']
  for (const r of results) {
    lines.push(`${r.index + 1}. [${t.verdict[r.status]}] ${r.raw}`)
    lines.push(`   ${reasonText(r, t)}`)
    const link = r.record?.doi ? `https://doi.org/${r.record.doi}` : r.record?.url
    if (link) lines.push(`   ${t.report.record}: ${link}`)
    lines.push('')
  }
  if (summary) {
    const { totals, tool } = summaryLines(summary, t)
    lines.push(totals, tool)
  }
  lines.push(t.home.statement)
  return lines.join('\n')
}

export function downloadText(filename: string, text: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function scholarUrl(result: ReferenceResult): string {
  const q = result.parsed.title ?? result.raw
  return `https://scholar.google.com/scholar?q=${encodeURIComponent(q)}`
}

export function recordUrl(result: ReferenceResult): string | null {
  const rec = result.record
  if (!rec) return null
  if (rec.doi) return `https://doi.org/${rec.doi}`
  return rec.url && /^https:\/\//i.test(rec.url) ? rec.url : null
}
