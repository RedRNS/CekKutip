import { maskKey } from '@cekkutip/shared/apikey'
import { useEffect, useId, useState } from 'react'
import type { FormEvent } from 'react'
import { fmt, useI18n } from '../i18n'

export interface ApiKeyPanelProps {
  /** The key held now, or null. */
  keyValue: string | null
  /** Returns "invalid" when the text cannot be a key. */
  onSave: (raw: string) => 'ok' | 'invalid'
  onClear: () => void
  /** One sentence about how this key is shared with the website or the extension, if it is. */
  linkNote?: string | null
  /**
   * True while using a key of one's own is the way forward (no shared reader, or it could not be
   * used). The panel opens when this turns true, and the person can still close it: it never
   * opens again on its own until this has turned false and then true again.
   */
  autoOpen?: boolean
}

/**
 * Lets a person use their own Gemini key instead of the site's shared one. Used by the website and
 * by the extension's side panel: where the key is kept is up to the caller.
 */
export function ApiKeyPanel({
  keyValue,
  onSave,
  onClear,
  linkNote = null,
  autoOpen = false,
}: ApiKeyPanelProps) {
  const { t } = useI18n()
  const inputId = useId()
  const hintId = useId()
  const [open, setOpen] = useState(autoOpen)
  useEffect(() => {
    if (autoOpen) setOpen(true)
  }, [autoOpen])
  const [draft, setDraft] = useState('')
  const [shown, setShown] = useState(false)
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (draft.trim() === '') return
    if (onSave(draft) === 'ok') {
      setDraft('')
      setShown(false)
      setNote({ ok: true, text: t.apiKey.saved })
    } else {
      setNote({ ok: false, text: t.apiKey.invalid })
    }
  }

  const remove = () => {
    onClear()
    setDraft('')
    setNote({ ok: true, text: t.apiKey.removed })
  }

  return (
    <details
      className="details keypanel"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>{t.apiKey.summary}</summary>
      <p className="hint">{t.apiKey.intro}</p>

      <form onSubmit={submit} noValidate>
        <label className="field-label" htmlFor={inputId}>
          {t.apiKey.label}
        </label>
        <input
          id={inputId}
          className="keypanel__input"
          type={shown ? 'text' : 'password'}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-describedby={hintId}
          aria-invalid={note !== null && !note.ok ? true : undefined}
        />
        <label className="check-row">
          <input type="checkbox" checked={shown} onChange={(e) => setShown(e.target.checked)} />
          <span>{t.apiKey.show}</span>
        </label>
        <div className="button-row">
          <button type="submit" className="btn btn--secondary" disabled={draft.trim() === ''}>
            {t.apiKey.save}
          </button>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={remove}
            disabled={keyValue === null}
          >
            {t.apiKey.remove}
          </button>
        </div>
      </form>

      <p className="keypanel__status" role="status">
        {keyValue === null
          ? t.apiKey.statusNone
          : fmt(t.apiKey.statusSet, { masked: maskKey(keyValue) })}
      </p>
      {note &&
        (note.ok ? (
          <p className="hint" role="status">
            {note.text}
          </p>
        ) : (
          <p className="field-error" role="alert">
            {note.text}
          </p>
        ))}

      <p id={hintId} className="hint">
        {t.apiKey.privacy}
      </p>
      {linkNote && <p className="hint">{linkNote}</p>}
      <p className="hint">
        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">
          {t.apiKey.getKey}
          <span className="visually-hidden"> ({t.evidence.opensNewTab})</span>
        </a>
      </p>
    </details>
  )
}
