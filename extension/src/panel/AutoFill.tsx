import { useEffect, useId, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useI18n } from '../../../apps/web/src/i18n'
import { SELECTION_MESSAGE, ensureAutoFill, turnOff, turnOn } from '../autofill'
import { chromeAutoFillApi } from '../autofill-chrome'

/**
 * The opt-in setting "Fill the box when I select text on a page", and the listener that receives
 * what the page script sends. Off by default: turning it on asks the browser for permission to read
 * the text selected on websites, and turning it off gives that permission back (see autofill.ts).
 */
export function AutoFill({ onSelection }: { onSelection: (text: string) => void }) {
  const { t } = useI18n()
  const [state, setState] = useState<'unknown' | 'on' | 'off'>('unknown')
  const [denied, setDenied] = useState(false)
  const [busy, setBusy] = useState(false)
  const hintId = useId()

  useEffect(() => {
    let alive = true
    // The choice and the permission must agree: the person may have taken the permission away in the
    // browser's settings since the panel was last open.
    void ensureAutoFill(chromeAutoFillApi()).then((s) => alive && setState(s))
    const listener = (message: unknown, sender: chrome.runtime.MessageSender) => {
      if (sender.id !== chrome.runtime.id) return
      const m = message as { type?: unknown; text?: unknown } | null
      if (m?.type === SELECTION_MESSAGE && typeof m.text === 'string') onSelection(m.text)
    }
    chrome.runtime.onMessage.addListener(listener)
    return () => {
      alive = false
      chrome.runtime.onMessage.removeListener(listener)
    }
  }, [onSelection])

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    setDenied(false)
    if (e.target.checked) {
      setBusy(true)
      // turnOn asks the browser first thing, still inside this click: the question needs the click.
      void turnOn(chromeAutoFillApi())
        .then((result) => {
          setState(result === 'on' ? 'on' : 'off')
          setDenied(result === 'denied')
        })
        .finally(() => setBusy(false))
    } else {
      setState('off')
      void turnOff(chromeAutoFillApi())
    }
  }

  return (
    <section className="autofill">
      <label className="check-row">
        <input
          type="checkbox"
          checked={state === 'on'}
          disabled={state === 'unknown' || busy}
          onChange={onChange}
          aria-describedby={state === 'on' ? undefined : hintId}
        />
        <span>{t.extension.autoFillLabel}</span>
      </label>
      {/* What it needs is shown while it is off. Once it is on, the short status is enough. */}
      {state !== 'on' && (
        <p id={hintId} className="hint">
          {t.extension.autoFillHint}
        </p>
      )}
      {(state === 'on' || denied) && (
        <p className="hint autofill__status" role="status">
          {state === 'on' ? t.extension.autoFillOn : t.extension.autoFillDenied}
        </p>
      )}
    </section>
  )
}
