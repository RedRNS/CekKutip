import type { ReferenceResult } from '@cekkutip/shared'
import { ExternalLink, Search } from 'lucide-react'
import { fmt, useI18n } from '../i18n'
import { recordUrl, scholarUrl } from '../lib/report'
import { CorrectedReference } from './CorrectedReference'
import { FieldTable } from './FieldTable'
import type { FieldRow } from './FieldTable'

/** Evidence for one result: side-by-side comparison, a link to the record, scores, and a next step. */
export function EvidencePanel({ result, id }: { result: ReferenceResult; id: string }) {
  const { t } = useI18n()
  const n = result.index + 1
  const record = result.record
  const link = recordUrl(result)
  const yearDiff = result.scores.yearDiff

  const rows: FieldRow[] = result.comparison.map((c) => ({
    field: c.field,
    cited: c.cited,
    found: c.found,
    state: c.state,
    note:
      c.field === 'year' && c.state === 'differs' && yearDiff !== null
        ? fmt(t.how.yearDiffers, { n: yearDiff })
        : null,
  }))

  // Only when the record is the same work as the one cited: a DOI that leads to another work is not a correction.
  const showCorrected =
    result.status === 'mismatch' &&
    record !== null &&
    !result.reasons.includes('mismatch_doi_other_work')
  const showScholar = result.status === 'out_of_index' || result.status === 'suspect'
  const compared = record !== null || result.scores.title > 0
  const score = (v: number) => (compared ? v.toFixed(2) : t.evidence.notCompared)

  return (
    <div className="evidence" id={id}>
      <FieldTable
        rows={rows}
        tone={result.status}
        labels={{
          caption: t.evidence.caption(n),
          field: t.evidence.field,
          cited: t.evidence.asCited,
          found: record
            ? fmt(t.evidence.recordFound, { source: t.sources[record.source] })
            : t.evidence.recordNone,
          status: t.evidence.status,
          fields: t.how.fields,
          states: t.how.states,
        }}
      />
      {!record && result.status !== 'check_failed' && (
        <p className="evidence__note">{t.evidence.noRecord}</p>
      )}

      <p className="evidence__next">
        <span className="label">{t.evidence.nextStep}</span> {t.evidence.next[result.status]}
      </p>

      {showCorrected && record && <CorrectedReference record={record} />}

      {(link || showScholar) && (
        <div className="evidence__actions">
          {link && (
            <a className="btn btn--secondary" href={link} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={16} aria-hidden="true" />
              <span>{t.evidence.openRecord}</span>
              <span className="visually-hidden">({t.evidence.opensNewTab})</span>
            </a>
          )}
          {showScholar && (
            <a
              className="btn btn--secondary"
              href={scholarUrl(result)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Search size={16} aria-hidden="true" />
              <span>{t.evidence.scholar}</span>
              <span className="visually-hidden">({t.evidence.opensNewTab})</span>
            </a>
          )}
        </div>
      )}

      <details className="details">
        <summary>{t.evidence.details}</summary>
        <dl className="scores">
          <div>
            <dt>{t.evidence.titleScore}</dt>
            <dd>{score(result.scores.title)}</dd>
          </div>
          <div>
            <dt>{t.evidence.authorsScore}</dt>
            <dd>{score(result.scores.authors)}</dd>
          </div>
          <div>
            <dt>{t.evidence.yearDiff}</dt>
            <dd>{yearDiff === null ? t.evidence.notCompared : yearDiff}</dd>
          </div>
          <div>
            <dt>{t.evidence.venueScore}</dt>
            <dd>{score(result.scores.venue)}</dd>
          </div>
          <div>
            <dt>{t.evidence.sourceType}</dt>
            <dd>{t.types[result.parsed.type]}</dd>
          </div>
          <div>
            <dt>{t.evidence.readBy}</dt>
            <dd>{t.evidence.readers[result.parsed.parseMode]}</dd>
          </div>
          <div>
            <dt>{t.evidence.reasonCodes}</dt>
            <dd className="mono">{result.reasons.join(', ')}</dd>
          </div>
        </dl>
      </details>
    </div>
  )
}
