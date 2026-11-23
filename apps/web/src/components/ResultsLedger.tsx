import { resultNotes } from '@cekkutip/shared'
import type { ReferenceResult } from '@cekkutip/shared'
import { Copy, Download } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { fmt, useI18n } from '../i18n'
import { downloadText, summaryLines, toCsv, toReport } from '../lib/report'
import { countByStatus } from '../state/check'
import type { CheckState } from '../state/check'
import { Legend } from './Legend'
import { PendingRow, ResultRow } from './ResultRow'
import { SummaryBar } from './SummaryBar'
import type { Filter } from './SummaryBar'

interface Props {
  state: CheckState
  limits: { maxReferences: number; maxReferenceChars: number }
  onRetry: () => void
}

const ANNOUNCE_EVERY_MS = 2000

/** Progress for screen readers: at most one update every two seconds, plus one when the check ends. */
function useAnnouncement(state: CheckState, progress: string, finished: string): string {
  const [message, setMessage] = useState('')
  const last = useRef(0)
  const latest = useRef(progress)
  latest.current = progress

  useEffect(() => {
    if (state.phase === 'done') {
      setMessage(finished)
      return
    }
    if (state.phase !== 'running') {
      setMessage('')
      return
    }
    const wait = Math.max(0, ANNOUNCE_EVERY_MS - (Date.now() - last.current))
    const id = window.setTimeout(() => {
      last.current = Date.now()
      setMessage(latest.current)
    }, wait)
    return () => window.clearTimeout(id)
  }, [state.phase, state.received, finished])

  return message
}

export function ResultsLedger({ state, limits, onRetry }: Props) {
  const { t, lang } = useI18n()
  const [filter, setFilter] = useState<Filter>('all')
  const [copied, setCopied] = useState<'idle' | 'ok' | 'failed'>('idle')
  const total = state.references.length
  const counts = useMemo(() => countByStatus(state.results), [state.results])
  const ordered = useMemo(
    () =>
      Object.values(state.results).sort(
        (a: ReferenceResult, b: ReferenceResult) => a.index - b.index,
      ),
    [state.results],
  )
  const notes = useMemo(() => resultNotes(ordered), [ordered])

  // A new check starts with every result showing.
  useEffect(() => {
    if (state.phase === 'running' && state.received === 0) {
      setFilter('all')
      setCopied('idle')
    }
  }, [state.phase, state.received])

  const progress = t.results.progress(state.received, total)
  const announcement = useAnnouncement(state, progress, t.results.finished(total))

  if (state.phase === 'idle') {
    return (
      <>
        <div className="results-empty">
          <p>{t.home.emptyHint}</p>
          <h3 className="results-empty__legend-title">{t.home.emptyLegend}</h3>
          <Legend />
        </div>
        <p className="results-statement">{t.home.statement}</p>
      </>
    )
  }

  const rows = state.references.map((text, index) => ({
    index,
    text,
    result: state.results[index],
  }))
  const visible = rows.filter((r) =>
    filter === 'all' ? true : r.result !== undefined && r.result.status === filter,
  )
  const waiting = state.phase === 'running'
  const hasResults = ordered.length > 0
  const date = new Date().toISOString().slice(0, 10)

  const exportCsv = () =>
    downloadText(`${t.report.filename}-${date}.csv`, toCsv(ordered, t), 'text/csv;charset=utf-8')

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(toReport(ordered, state.summary, t, date))
      setCopied('ok')
    } catch {
      setCopied('failed')
    }
  }

  // Limits are checked in the browser before sending, so a length error from the server is unexpected.
  const errorText =
    state.error === null
      ? null
      : state.error === 'reference_too_long'
        ? t.errors.generic
        : fmt(t.errors[state.error], { max: limits.maxReferences })

  const printLines = state.summary ? summaryLines(state.summary, t) : null

  return (
    <>
      {hasResults && !waiting && printLines && (
        <div className="print-only print-head">
          <p className="print-head__title">{t.report.title}</p>
          <p>{date}</p>
          <p>{printLines.totals}</p>
          <p>{printLines.tool}</p>
          {filter !== 'all' && (
            <p>
              {fmt(t.results.printFiltered, {
                verdict: t.verdict[filter],
                shown: visible.length,
                total: ordered.length,
              })}
            </p>
          )}
        </div>
      )}
      <p className="progress" data-lang={lang}>
        {progress}
      </p>
      <p className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>

      {state.phase === 'error' && errorText && (
        <div className="banner" role="alert">
          <p className="banner__title">{t.errors.title}</p>
          <p>{errorText}</p>
          <button type="button" className="btn btn--secondary" onClick={onRetry}>
            {t.errors.tryAgain}
          </button>
        </div>
      )}

      {state.summary?.aiIssue && (
        <div className="banner" role="status">
          <p>
            {
              t.results.aiIssue[
                `${state.summary.aiIssue}${state.ownKey ? 'Own' : 'Shared'}` as keyof typeof t.results.aiIssue
              ]
            }
          </p>
        </div>
      )}

      <SummaryBar counts={counts} total={total} filter={filter} onFilter={setFilter} />

      <ol className="ledger">
        {visible.map((r) =>
          r.result ? (
            <ResultRow key={r.index} result={r.result} notes={notes.get(r.index)} />
          ) : waiting ? (
            <PendingRow key={r.index} index={r.index} text={r.text} />
          ) : null,
        )}
      </ol>
      {visible.length === 0 && <p className="ledger__none">{t.results.noneInFilter}</p>}

      {hasResults && !waiting && (
        <div className="export-row">
          <button type="button" className="btn btn--secondary" onClick={exportCsv}>
            <Download size={16} aria-hidden="true" />
            <span>{t.results.exportCsv}</span>
          </button>
          <button type="button" className="btn btn--secondary" onClick={() => void copyReport()}>
            <Copy size={16} aria-hidden="true" />
            <span>{t.results.copyReport}</span>
          </button>
          <span className="export-row__status" role="status">
            {copied === 'ok' ? t.results.copied : copied === 'failed' ? t.results.copyFailed : ''}
          </span>
        </div>
      )}

      <p className="results-statement">{t.home.statement}</p>
    </>
  )
}
