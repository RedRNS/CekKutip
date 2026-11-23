import { FORMAT_STYLES, annotate, formatReferences } from '@cekkutip/shared/refformat'
import type { FormatItem, FormatStyle, NoteCode } from '@cekkutip/shared/refformat'
import { splitReferences } from '@cekkutip/shared/split'
import { Copy } from 'lucide-react'
import { useDeferredValue, useId, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FORMAT_EXAMPLE_REFERENCES, FORMAT_EXAMPLE_TEXT } from '../data/format-example'
import { fmt, useI18n } from '../i18n'
import type { Dict } from '../i18n/en'
import { copyPlain, copyRich } from '../lib/clipboard'
import { itemHtml, itemText, listHtml, listText } from '../lib/formatExport'
import { appendText } from '../lib/upload'
import { MAX_UPLOAD_KB, useReferenceFiles } from '../lib/useReferenceFiles'
import type { BibFile } from '../lib/useReferenceFiles'
import { BibtexPanel } from './BibtexPanel'
import { UploadNotes } from './UploadNotes'

const STYLE_KEY = 'cekkutip.format.style'

/** The last style the person chose. A convenience only: if the browser keeps nothing, APA is used. */
function readStyle(): FormatStyle {
  try {
    const stored = localStorage.getItem(STYLE_KEY)
    return FORMAT_STYLES.find((s) => s === stored) ?? 'apa'
  } catch {
    return 'apa'
  }
}

function saveStyle(style: FormatStyle) {
  try {
    localStorage.setItem(STYLE_KEY, style)
  } catch {
    /* the browser keeps nothing: the choice lasts until the page is closed */
  }
}

const collapse = (s: string) => s.replace(/\s+/g, ' ').trim()

function noteText(t: Dict, code: NoteCode, styleName: string): string {
  const note = t.format.notes[code]
  return typeof note === 'function' ? note(styleName) : note
}

type CopyState = 'idle' | 'ok' | 'failed'
const copyText = (t: Dict, state: CopyState) =>
  state === 'ok' ? t.format.copied : state === 'failed' ? t.format.copyFailed : ''

function FormatRow({ item, styleName }: { item: FormatItem; styleName: string }) {
  const { t } = useI18n()
  const [copied, setCopied] = useState<CopyState>('idle')
  const runs = useMemo(
    () => (item.status === 'not_rewritten' ? [] : annotate(item.pieces, collapse(item.raw))),
    [item],
  )

  const copy = async () => {
    setCopied((await copyRich(itemHtml(item), itemText(item))) ? 'ok' : 'failed')
  }

  const status =
    item.status === 'changed'
      ? t.format.status.changed
      : item.status === 'same'
        ? t.format.status.same(styleName)
        : t.format.status.not_rewritten

  return (
    <li className={`fmt-row fmt-row--${item.status}`}>
      <div className="fmt-row__head">
        <span className="fmt-row__num">{t.format.reference(item.index + 1)}</span>
        <span className="fmt-row__status">{status}</span>
      </div>

      {item.status === 'not_rewritten' ? (
        <>
          <p className="fmt-text">{item.text}</p>
          {item.reason !== null && <p className="evidence__note">{t.format.reasons[item.reason]}</p>}
        </>
      ) : (
        <>
          <div className="fmt-block">
            <p className="label">{t.format.asWritten}</p>
            <p className="fmt-text fmt-text--written">{collapse(item.raw)}</p>
          </div>
          <div className="fmt-block">
            <p className="label">{t.format.inStyle(styleName)}</p>
            <p className="fmt-text">
              {item.label !== null && <span className="fmt-label">{item.label} </span>}
              {runs.map((run, i) => {
                const cls = run.changed ? 'diff' : undefined
                return run.italic ? (
                  <i key={i} className={cls}>
                    {run.text}
                  </i>
                ) : (
                  <span key={i} className={cls}>
                    {run.text}
                  </span>
                )
              })}
            </p>
          </div>
          {item.changes.length > 0 && (
            <div className="fmt-block">
              <p className="label">{t.format.whatChanged}</p>
              <ul className="fmt-changes">
                {item.changes.map((c) => (
                  <li key={c.field}>
                    <span className="fmt-field">{t.format.fields[c.field]}</span>{' '}
                    <span className="fmt-before">{c.before === '' ? t.format.nothing : c.before}</span>{' '}
                    <span aria-hidden="true">{'→'}</span>
                    <span className="visually-hidden"> {t.format.arrow} </span>{' '}
                    <span className="fmt-after">{c.after === '' ? t.format.noPart : c.after}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {item.notes.length > 0 && (
        <div className="fmt-block fmt-notes">
          <p className="label">{t.format.notesTitle}</p>
          <ul className="plain-list plain-list--tight">
            {item.notes.map((code) => (
              <li key={code}>{noteText(t, code, styleName)}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="evidence__actions">
        <button
          type="button"
          className="btn btn--secondary btn--compact"
          onClick={() => void copy()}
          aria-label={t.format.copyOneLabel(item.index + 1)}
        >
          <Copy size={16} aria-hidden="true" />
          <span>{t.format.copyOne}</span>
        </button>
        <span className="export-row__status" role="status">
          {copyText(t, copied)}
        </span>
      </div>
    </li>
  )
}

/**
 * Rewrite a pasted list of references in APA 7, IEEE, or Harvard. It all happens here in the browser, by fixed
 * rules from `@cekkutip/shared/refformat`: no request is made and no model reads the text.
 */
export function FormatTool() {
  const { t } = useI18n()
  const [text, setText] = useState('')
  const [style, setStyle] = useState<FormatStyle>(readStyle)
  const [sort, setSort] = useState(true)
  const [sentenceCase, setSentenceCase] = useState(false)
  const [copiedAll, setCopiedAll] = useState<CopyState>('idle')
  // .bib files that were loaded, as they were, and the two habits the cleaned copy may put right.
  const [bibFiles, setBibFiles] = useState<BibFile[]>([])
  const [monthFromYear, setMonthFromYear] = useState(false)
  const [dropDoiCopies, setDropDoiCopies] = useState(false)
  const inputId = useId()
  const styleHintId = useId()
  const fileRef = useRef<HTMLInputElement>(null)

  const upload = useReferenceFiles(
    (added) => setText((prev) => appendText(prev, added)),
    (file) => setBibFiles((prev) => [...prev.filter((f) => f.name !== file.name), file]),
  )

  // Typing stays smooth with a long list: the rewrite follows a moment behind.
  const deferred = useDeferredValue(text)
  const references = useMemo(() => splitReferences(deferred), [deferred])
  const items = useMemo(
    () => formatReferences(references, { style, sentenceCase, sort }),
    [references, style, sentenceCase, sort],
  )
  const found = useMemo(() => splitReferences(text).length, [text])

  const styleName = t.format.styles[style]
  const changed = items.filter((i) => i.status === 'changed').length
  const same = items.filter((i) => i.status === 'same').length
  const kept = items.length - changed - same

  const chooseStyle = (next: FormatStyle) => {
    setStyle(next)
    saveStyle(next)
    setCopiedAll('idle')
  }

  const copyAll = async (rich: boolean) => {
    const ok = rich
      ? await copyRich(listHtml(items), listText(items))
      : await copyPlain(listText(items))
    setCopiedAll(ok ? 'ok' : 'failed')
  }

  return (
    <div className="workbench">
      <section className="panel panel--input print-hide" aria-labelledby={`${inputId}-label`}>
        {upload.dropping && (
          <div className="dropzone" aria-hidden="true">
            <div className="dropzone__message">
              <p className="dropzone__title">{t.upload.dropTitle}</p>
              <p className="dropzone__hint">{t.upload.dropHint}</p>
            </div>
          </div>
        )}

        <fieldset className="fmt-styles" aria-describedby={styleHintId}>
          <legend className="field-label">{t.format.styleLegend}</legend>
          <div className="fmt-styles__row">
            {FORMAT_STYLES.map((s) => (
              <label key={s} className="fmt-style">
                <input
                  type="radio"
                  name="format-style"
                  value={s}
                  checked={style === s}
                  onChange={() => chooseStyle(s)}
                />
                <span>{t.format.styles[s]}</span>
              </label>
            ))}
          </div>
          <p id={styleHintId} className="hint">
            {t.format.styleNote[style]}
          </p>
        </fieldset>

        <div className="panel__row">
          <label className="field-label" id={`${inputId}-label`} htmlFor={inputId}>
            {t.format.inputLabel}
          </label>
          <span className="count">{t.home.found(found)}</span>
        </div>
        <textarea
          id={inputId}
          className="textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={FORMAT_EXAMPLE_REFERENCES.slice(0, 2).join('\n\n')}
          spellCheck={false}
        />
        <p className="hint">{t.home.placeholderHint}</p>

        {style === 'ieee' ? (
          <p className="hint">{t.format.ieeeOrder}</p>
        ) : (
          <label className="check-row">
            <input type="checkbox" checked={sort} onChange={(e) => setSort(e.target.checked)} />
            <span>{t.format.sortLabel}</span>
          </label>
        )}
        <label className="check-row">
          <input
            type="checkbox"
            checked={sentenceCase}
            onChange={(e) => setSentenceCase(e.target.checked)}
            aria-describedby={`${inputId}-sentence`}
          />
          <span>{t.format.sentenceLabel}</span>
        </label>
        <p id={`${inputId}-sentence`} className="hint">
          {t.format.sentenceHint}
        </p>

        <p className="notice">
          {t.format.privacy} <Link to="/privacy">{t.home.noticeLink}</Link>
        </p>

        <div className="button-row">
          <button type="button" className="btn btn--secondary" onClick={() => setText(FORMAT_EXAMPLE_TEXT)}>
            {t.format.example}
          </button>
          <button type="button" className="btn btn--secondary" onClick={() => fileRef.current?.click()}>
            {t.upload.button}
          </button>
          <input ref={fileRef} type="file" accept=".txt,.bib,text/plain" hidden onChange={upload.onFile} />
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => {
              setText('')
              setBibFiles([])
              upload.clearNote()
              setCopiedAll('idle')
            }}
            disabled={text === '' && bibFiles.length === 0}
          >
            {t.format.clear}
          </button>
        </div>
        <p className="hint">{fmt(t.upload.hint, { max: MAX_UPLOAD_KB })}</p>
        <UploadNotes note={upload.note} />
      </section>

      <section className="panel panel--results" aria-labelledby={`${inputId}-results`}>
        <h2 id={`${inputId}-results`} className="panel__title">
          {t.format.resultsTitle}
        </h2>
        {items.length === 0 ? (
          <p className="muted">{t.format.empty}</p>
        ) : (
          <>
            <p className="fmt-summary" role="status">
              {t.format.summary(items.length, changed, same, kept)}
            </p>
            <div className="evidence__actions">
              <button type="button" className="btn btn--secondary" onClick={() => void copyAll(true)}>
                <Copy size={16} aria-hidden="true" />
                <span>{t.format.copyAll}</span>
              </button>
              <button type="button" className="btn btn--secondary" onClick={() => void copyAll(false)}>
                <Copy size={16} aria-hidden="true" />
                <span>{t.format.copyAllPlain}</span>
              </button>
              <span className="export-row__status" role="status">
                {copyText(t, copiedAll)}
              </span>
            </div>
            <BibtexPanel
              files={bibFiles}
              items={items}
              monthFromYear={monthFromYear}
              dropDoiCopies={dropDoiCopies}
              onMonthFromYear={setMonthFromYear}
              onDropDoiCopies={setDropDoiCopies}
            />
            <ol className="fmt-list">
              {items.map((item) => (
                <FormatRow key={`${style}-${item.index}`} item={item} styleName={styleName} />
              ))}
            </ol>
          </>
        )}
      </section>
    </div>
  )
}
