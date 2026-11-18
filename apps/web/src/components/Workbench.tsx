import type { PublicConfig } from '@cekkutip/shared'
import { checkLimits, joinReferences, splitReferences } from '@cekkutip/shared/split'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { EXAMPLE_TEXT, PLACEHOLDER_EXAMPLES } from '../data/example-list'
import { fmt, useI18n } from '../i18n'
import { DEFAULT_CONFIG, fetchConfig } from '../lib/api'
import { MAX_UPLOAD_BYTES, appendText, readReferenceFile } from '../lib/upload'
import { useCheck } from '../state/useCheck'
import { ResultsLedger } from './ResultsLedger'
import { SplitPreview } from './SplitPreview'

/**
 * The tool itself. Left: paste references. Right: results, one row per reference, as they arrive.
 * The list is split in the browser with the same code the server uses, so "N found" is what gets checked.
 */
export function Workbench() {
  const { t } = useI18n()
  const [text, setText] = useState('')
  const [noAi, setNoAi] = useState(false)
  const [config, setConfig] = useState<PublicConfig>(DEFAULT_CONFIG)
  const { state, run, reset } = useCheck()
  const inputId = useId()
  const hintId = useId()
  const errorId = useId()
  const resultsRef = useRef<HTMLElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploadNote, setUploadNote] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    const ac = new AbortController()
    void fetchConfig(ac.signal).then((c) => {
      if (!ac.signal.aborted) setConfig(c)
    })
    return () => ac.abort()
  }, [])

  const references = useMemo(() => splitReferences(text), [text])
  const problem = useMemo(() => checkLimits(references, config), [references, config])
  const problemText =
    problem === null
      ? null
      : problem.error === 'too_many_references'
        ? fmt(t.errors.too_many_references, { max: problem.limit })
        : fmt(t.errors.reference_too_long, { n: problem.index + 1, max: problem.limit })

  const running = state.phase === 'running'
  const hasText = text.trim() !== ''
  const canCheck = references.length > 0 && problem === null && !running
  const useRegex = noAi || !config.aiAvailable

  const check = useCallback(() => {
    if (!canCheck) return
    void run(references, useRegex ? 'regex' : 'llm')
    // On a narrow screen the results sit below the input: bring them into view.
    if (window.matchMedia('(max-width: 899px)').matches) {
      resultsRef.current?.scrollIntoView({ block: 'start' })
    }
  }, [canCheck, run, references, useRegex])

  const retry = useCallback(() => {
    if (state.references.length > 0) void run(state.references, state.parseMode)
  }, [run, state.references, state.parseMode])

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      check()
    }
  }

  const clear = () => {
    setText('')
    setUploadNote(null)
    reset()
  }

  const maxKb = MAX_UPLOAD_BYTES / 1024
  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // so the same file can be chosen again
    if (!file) return
    const r = await readReferenceFile(file)
    if (!r.ok) {
      setUploadNote({ ok: false, text: fmt(t.upload.errors[r.error], { max: maxKb }) })
      return
    }
    setText((prev) => appendText(prev, r.text))
    const added = t.upload.added(splitReferences(r.text).length, file.name)
    setUploadNote({
      ok: true,
      text: r.skipped > 0 ? `${added} ${t.upload.skipped(r.skipped)}` : added,
    })
  }

  return (
    <div className="workbench">
      <section className="panel panel--input print-hide" aria-labelledby={`${inputId}-label`}>
        <div className="panel__row">
          <label className="field-label" id={`${inputId}-label`} htmlFor={inputId}>
            {t.home.inputLabel}
          </label>
          <span className="count">{t.home.found(references.length)}</span>
        </div>
        <textarea
          id={inputId}
          className={problemText ? 'textarea textarea--invalid' : 'textarea'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={PLACEHOLDER_EXAMPLES.join('\n\n')}
          spellCheck={false}
          aria-describedby={problemText ? `${hintId} ${errorId}` : hintId}
          aria-invalid={problemText ? true : undefined}
        />
        <p id={hintId} className="hint">
          {t.home.placeholderHint}
        </p>
        {problemText && (
          <p id={errorId} className="field-error" role="alert">
            {problemText}
          </p>
        )}

        <SplitPreview references={references} onChange={(refs) => setText(joinReferences(refs))} />

        <label className="check-row">
          <input
            type="checkbox"
            checked={useRegex}
            disabled={!config.aiAvailable}
            onChange={(e) => setNoAi(e.target.checked)}
          />
          <span>{t.home.noAi}</span>
        </label>

        <p className="notice">
          {config.aiAvailable ? t.home.notice : t.workbench.aiUnavailable}{' '}
          <Link to="/privacy">{t.home.noticeLink}</Link>
        </p>

        <div className="button-row">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => setText(EXAMPLE_TEXT)}
          >
            {t.home.example}
          </button>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => fileRef.current?.click()}
          >
            {t.upload.button}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.bib,text/plain"
            hidden
            onChange={(e) => void onFile(e)}
          />
          <button
            type="button"
            className="btn btn--secondary"
            onClick={clear}
            disabled={!hasText && state.phase === 'idle'}
          >
            {t.home.clear}
          </button>
        </div>
        <p className="hint">{fmt(t.upload.hint, { max: maxKb })}</p>
        {uploadNote &&
          (uploadNote.ok ? (
            <p className="hint" role="status">
              {uploadNote.text}
            </p>
          ) : (
            <p className="field-error" role="alert">
              {uploadNote.text}
            </p>
          ))}

        <div className={hasText ? 'check-bar check-bar--sticky' : 'check-bar'}>
          <button type="button" className="btn btn--primary" onClick={check} disabled={!canCheck}>
            <span>{running ? t.workbench.checkingButton : t.home.check}</span>
            {!running && (
              <kbd className="btn__kbd" aria-hidden="true">
                {t.workbench.shortcut}
              </kbd>
            )}
          </button>
        </div>
      </section>

      <section
        className="panel panel--results"
        aria-labelledby="results-title"
        ref={resultsRef}
        aria-busy={running}
      >
        <h2 id="results-title" className="panel__title">
          {t.home.resultsTitle}
        </h2>
        <ResultsLedger state={state} limits={config} onRetry={retry} />
      </section>
    </div>
  )
}
