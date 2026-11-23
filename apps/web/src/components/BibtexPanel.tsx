import { bibtexFromReferences, cleanBibtex } from '@cekkutip/shared/refformat'
import type { BibFix, BibFlag, CleanBibResult, FormatItem } from '@cekkutip/shared/refformat'
import { Download } from 'lucide-react'
import { useId, useMemo } from 'react'
import { useI18n } from '../i18n'
import type { Dict } from '../i18n/en'
import { cleanedFileName, downloadText } from '../lib/download'
import type { BibFile } from '../lib/useReferenceFiles'

const BIB_TYPE = 'text/x-bibtex'

function fixText(t: Dict, f: BibFix): string {
  const to = f.after === '' ? t.format.bib.removed : f.after
  return `${f.field}: ${f.before} → ${to}`
}

const flagText = (t: Dict, f: BibFlag): string => t.format.bib.flags[f.code](f.detail)

function BibFileCard({ file, result }: { file: BibFile; result: CleanBibResult }) {
  const { t } = useI18n()
  const nothing = result.fixes.length === 0 && result.flags.length === 0
  return (
    <div className="bib-card">
      <h4 className="bib-card__title">{t.format.bib.fileTitle(file.name, result.entries)}</h4>
      <p className="bib-card__summary">
        {nothing ? t.format.bib.nothingToFix : t.format.bib.summary(result.fixes.length, result.flags.length)}
      </p>

      {result.fixes.length > 0 && (
        <details className="details bib-details">
          <summary>{t.format.bib.fixesTitle(result.fixes.length)}</summary>
          <ul className="bib-list">
            {result.fixes.map((f, i) => (
              <li key={`${f.key}-${f.rule}-${i}`}>
                <span className="bib-key">{f.key}</span> {t.format.bib.rules[f.rule]}
                <span className="bib-change">{fixText(t, f)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {result.flags.length > 0 && (
        <details className="details bib-details" open>
          <summary>{t.format.bib.flagsTitle(result.flags.length)}</summary>
          <ul className="bib-list">
            {result.flags.map((f, i) => (
              <li key={`${f.key}-${f.code}-${i}`}>
                <span className="bib-key">{f.key === '' ? '—' : f.key}</span> {flagText(t, f)}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="evidence__actions">
        <button
          type="button"
          className="btn btn--secondary"
          onClick={() => downloadText(cleanedFileName(file.name), result.text, BIB_TYPE)}
        >
          <Download size={16} aria-hidden="true" />
          <span>{t.format.bib.download}</span>
        </button>
      </div>
    </div>
  )
}

function NewBibCard({ items }: { items: FormatItem[] }) {
  const { t } = useI18n()
  const previewId = useId()
  const written = useMemo(
    () =>
      bibtexFromReferences(
        items.map((i) => ({ article: i.article, text: i.text })),
        { header: t.format.bib.header, kept: t.format.bib.keptHeader },
      ),
    [items, t],
  )
  return (
    <div className="bib-card">
      <h4 className="bib-card__title">{t.format.bib.newTitle}</h4>
      {written.entries === 0 ? (
        <p className="bib-card__summary">{t.format.bib.nothingToWrite}</p>
      ) : (
        <>
          <p className="bib-card__summary">{t.format.bib.newSummary(written.entries, written.kept)}</p>
          <p className="evidence__note">{t.format.bib.newNote}</p>
          <details className="details bib-details">
            <summary>{t.format.bib.preview}</summary>
            <pre
              className="bib-pre"
              id={previewId}
              tabIndex={0}
              role="region"
              aria-label={t.format.bib.previewLabel}
            >
              {written.text}
            </pre>
          </details>
          <div className="evidence__actions">
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => downloadText('references.bib', written.text, BIB_TYPE)}
            >
              <Download size={16} aria-hidden="true" />
              <span>{t.format.bib.downloadNew}</span>
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export interface BibtexPanelProps {
  /** .bib files that were loaded, as they were. */
  files: BibFile[]
  /** The references as read from the text box. */
  items: FormatItem[]
  monthFromYear: boolean
  dropDoiCopies: boolean
  onMonthFromYear: (on: boolean) => void
  onDropDoiCopies: (on: boolean) => void
}

/**
 * Download a .bib: a cleaned copy of each loaded .bib file (its keys and text kept, only plain mistakes fixed,
 * the rest flagged), or, with no file loaded, a new .bib made from the references in the box. All in the browser.
 */
export function BibtexPanel({
  files,
  items,
  monthFromYear,
  dropDoiCopies,
  onMonthFromYear,
  onDropDoiCopies,
}: BibtexPanelProps) {
  const { t } = useI18n()
  const titleId = useId()
  const results = useMemo(() => {
    const now = new Date()
    return files.map((f) => cleanBibtex(f.text, { monthFromYear, dropDoiCopies, now }))
  }, [files, monthFromYear, dropDoiCopies])

  const monthCount = results.reduce((n, r) => n + r.offered.monthInYear, 0)
  const copiesCount = results.reduce((n, r) => n + r.offered.doiCopies, 0)

  if (files.length === 0 && items.length === 0) return null
  return (
    <section className="bib-panel print-hide" aria-labelledby={titleId}>
      <h3 id={titleId} className="bib-panel__title">
        {t.format.bib.title}
      </h3>
      {files.length === 0 ? (
        <NewBibCard items={items} />
      ) : (
        <>
          <p className="evidence__note">{t.format.bib.keepsNote}</p>
          <p className="evidence__note">{t.format.bib.loadedNote}</p>
          <fieldset className="bib-switches">
            <legend className="label">{t.format.bib.switchesTitle}</legend>
            <p className="evidence__note">{t.format.bib.switchesNote}</p>
            <label className="check-row">
              <input
                type="checkbox"
                checked={monthFromYear}
                onChange={(e) => onMonthFromYear(e.target.checked)}
              />
              <span>{t.format.bib.monthLabel}</span>
            </label>
            <p className="hint">{t.format.bib.monthHint(monthCount)}</p>
            <label className="check-row">
              <input
                type="checkbox"
                checked={dropDoiCopies}
                onChange={(e) => onDropDoiCopies(e.target.checked)}
              />
              <span>{t.format.bib.copiesLabel}</span>
            </label>
            <p className="hint">{t.format.bib.copiesHint(copiesCount)}</p>
          </fieldset>
          {files.map((f, i) => (
            <BibFileCard key={f.name} file={f} result={results[i] as CleanBibResult} />
          ))}
        </>
      )}
    </section>
  )
}
