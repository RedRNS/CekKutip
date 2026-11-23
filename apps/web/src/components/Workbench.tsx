import type { PublicConfig } from '@cekkutip/shared'
import { checkLimits, joinReferences, splitReferences } from '@cekkutip/shared/split'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { EXAMPLE_TEXT, PLACEHOLDER_EXAMPLES } from '../data/example-list'
import { fmt, useI18n } from '../i18n'
import { DEFAULT_CONFIG, fetchConfig } from '../lib/api'
import { getKeyStore, useApiKey } from '../lib/apiKey'
import type { ApiKeyView } from '../lib/apiKey'
import { decideSelection, snippet } from '../lib/selection'
import { MAX_UPLOAD_BYTES, appendText, readReferenceFile } from '../lib/upload'
import { useCheck } from '../state/useCheck'
import { ApiKeyPanel } from './ApiKeyPanel'
import { ResultsLedger } from './ResultsLedger'
import { SplitPreview } from './SplitPreview'

/** Read when a check starts, so the check always uses the key held at that moment. */
const getOwnKey = () => getKeyStore().getState().key

export interface WorkbenchCoreProps {
  /** Where the person's own Gemini key is kept: the website's storage, or the extension's. */
  keyApi: ApiKeyView
  /** Read when a check starts. */
  getKey: () => string | null
  /** The server to ask. The website uses its own origin (leave empty); the extension names one. */
  baseUrl?: string
  /** Text to start with, for example a selection sent from the extension's menu. */
  initialText?: string
  /**
   * Text that arrives while the tool is already open (a selection sent from the menu to an open side
   * panel). It replaces what is in the box and leaves the results, and any check in progress, alone.
   * `n` changes with every arrival, so the same text sent twice still counts.
   */
  incomingText?: { text: string; n: number } | null
  /**
   * Text the person selected on a web page while the side panel is open (an opt-in setting of the
   * extension). It fills the box when the box is empty or still holds the previous selection. If the
   * person's own text is there, it is offered in a notice instead, never put over it.
   */
  liveSelection?: { text: string; n: number } | null
  /** An absolute address for the Privacy page, for places that have no router (the extension). */
  privacyHref?: string
  /** A sentence about how the key is shared. The website derives it from the connection when empty. */
  keyLinkNote?: string | null
}

/** The website's tool: its key lives in this browser and is shared with the extension, if present. */
export function Workbench() {
  const keyApi = useApiKey()
  return <WorkbenchCore keyApi={keyApi} getKey={getOwnKey} />
}

/**
 * The tool itself. Left: paste references. Right: results, one row per reference, as they arrive.
 * The list is split in the browser with the same code the server uses, so "N found" is what gets checked.
 * The website and the extension's side panel both render this.
 */
export function WorkbenchCore({
  keyApi: apiKey,
  getKey,
  baseUrl,
  initialText = '',
  incomingText = null,
  liveSelection = null,
  privacyHref,
  keyLinkNote,
}: WorkbenchCoreProps) {
  const { t } = useI18n()
  const [text, setText] = useState(initialText)
  const [noAi, setNoAi] = useState(false)
  const [config, setConfig] = useState<PublicConfig>(DEFAULT_CONFIG)
  const { state, run, reset } = useCheck({ getKey, baseUrl })
  const inputId = useId()
  const hintId = useId()
  const errorId = useId()
  const resultsRef = useRef<HTMLElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploadNote, setUploadNote] = useState<{ ok: boolean; text: string } | null>(null)

  // What a selection from the page put in the box, so a newer selection can replace it but never the
  // person's own text. textRef lets the effect below read the box without re-running on every key.
  const textRef = useRef(text)
  const lastFilled = useRef<string | null>(null)
  const [offered, setOffered] = useState<string | null>(null)
  useEffect(() => {
    textRef.current = text
  })

  useEffect(() => {
    if (incomingText) {
      setText(incomingText.text)
      setUploadNote(null)
      setOffered(null)
      lastFilled.current = incomingText.text
    }
  }, [incomingText])

  useEffect(() => {
    if (!liveSelection) return
    const action = decideSelection({
      box: textRef.current,
      lastFilled: lastFilled.current,
      incoming: liveSelection.text,
    })
    if (action === 'fill') {
      setText(liveSelection.text)
      setUploadNote(null)
      setOffered(null)
      lastFilled.current = liveSelection.text
    } else if (action === 'ask') {
      setOffered(liveSelection.text)
    }
  }, [liveSelection])

  useEffect(() => {
    const ac = new AbortController()
    void fetchConfig(ac.signal, { baseUrl }).then((c) => {
      if (!ac.signal.aborted) setConfig(c)
    })
    return () => ac.abort()
  }, [baseUrl])

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
  // A person's own key makes the AI reader available even where the server has none of its own.
  const aiUsable = config.aiAvailable || apiKey.key !== null
  const useRegex = noAi || !aiUsable
  // The key panel opens by itself when the person's own key is the way to the AI reader: the server
  // has none, or the last check could not use the model (limit reached, or a key Google refused).
  const keyIsTheWayForward = !aiUsable || Boolean(state.summary?.aiIssue)

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
    setOffered(null)
    lastFilled.current = null
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
        {offered !== null && (
          <div className="selection-offer" role="status">
            <p className="selection-offer__label">{t.extension.liveOffer}</p>
            <p className="selection-offer__text">{snippet(offered)}</p>
            <div className="selection-offer__actions">
              <button
                type="button"
                className="btn btn--secondary btn--compact"
                onClick={() => {
                  setText((prev) => appendText(prev, offered))
                  lastFilled.current = null
                  setOffered(null)
                }}
              >
                {t.extension.liveAdd}
              </button>
              <button
                type="button"
                className="btn btn--secondary btn--compact"
                onClick={() => {
                  setText(offered)
                  lastFilled.current = offered
                  setOffered(null)
                }}
              >
                {t.extension.liveReplace}
              </button>
              <button
                type="button"
                className="btn btn--secondary btn--compact"
                onClick={() => setOffered(null)}
              >
                {t.extension.liveIgnore}
              </button>
            </div>
          </div>
        )}
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
            disabled={!aiUsable}
            onChange={(e) => setNoAi(e.target.checked)}
          />
          <span>{t.home.noAi}</span>
        </label>

        <p className="notice">
          {aiUsable ? t.home.notice : t.workbench.aiUnavailable}{' '}
          {privacyHref ? (
            <a href={privacyHref} target="_blank" rel="noopener noreferrer">
              {t.home.noticeLink}
            </a>
          ) : (
            <Link to="/privacy">{t.home.noticeLink}</Link>
          )}
        </p>

        <ApiKeyPanel
          autoOpen={keyIsTheWayForward}
          keyValue={apiKey.key}
          onSave={apiKey.save}
          onClear={apiKey.clear}
          linkNote={keyLinkNote ?? (apiKey.connected ? t.apiKey.linked : null)}
        />

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
