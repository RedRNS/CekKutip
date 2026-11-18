import { mergeWithPrevious, replaceReference } from '@cekkutip/shared/split'
import { useEffect, useId, useState } from 'react'
import { useI18n } from '../i18n'

interface Props {
  /** The list as the splitter reads it now. */
  references: string[]
  /** Called with the edited list. The caller writes it back into the input box. */
  onChange: (references: string[]) => void
}

/**
 * Shows how the pasted text was split, and lets the person fix a wrong cut: merge a reference into
 * the previous one, or edit it (a blank line in the edit splits it in two). The list stays the
 * single source of truth, so what is shown here is exactly what gets checked.
 */
export function SplitPreview({ references, onChange }: Props) {
  const { t } = useI18n()
  const base = useId()
  const [editing, setEditing] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const [focusIndex, setFocusIndex] = useState<number | null>(null)
  const [announcement, setAnnouncement] = useState('')

  // After a change the clicked button may be gone: move focus to the reference that took its place.
  useEffect(() => {
    if (focusIndex === null) return
    document.getElementById(`${base}-item-${focusIndex}`)?.focus()
    setFocusIndex(null)
  }, [focusIndex, base])

  // The list can change under an open edit (the person types in the box): drop a stale edit.
  useEffect(() => {
    if (editing !== null && editing >= references.length) setEditing(null)
  }, [editing, references.length])

  const merge = (index: number) => {
    const next = mergeWithPrevious(references, index)
    onChange(next)
    setEditing(null)
    setFocusIndex(index - 1)
    setAnnouncement(t.split.merged(index + 1, next.length))
  }

  const startEdit = (index: number) => {
    setDraft(references[index] as string)
    setEditing(index)
    setAnnouncement('')
  }

  const apply = (index: number) => {
    const next = replaceReference(references, index, draft)
    onChange(next)
    setEditing(null)
    setFocusIndex(Math.min(index, next.length - 1))
    setAnnouncement(t.split.updated(next.length))
  }

  const cancel = (index: number) => {
    setEditing(null)
    setFocusIndex(index)
  }

  if (references.length === 0) return null

  return (
    <details className="details split">
      <summary>{t.split.summary(references.length)}</summary>
      <p className="hint">{t.split.hint}</p>
      <ol className="split__list">
        {references.map((ref, i) => (
          <li
            // Position is the identity: the list is rebuilt from text on every change.
            key={i}
            id={`${base}-item-${i}`}
            tabIndex={-1}
            className="split__item"
            aria-label={t.split.item(i + 1)}
          >
            {editing === i ? (
              <div className="split__edit">
                <label className="visually-hidden" htmlFor={`${base}-edit-${i}`}>
                  {t.split.editLabel(i + 1)}
                </label>
                <textarea
                  id={`${base}-edit-${i}`}
                  className="textarea split__textarea"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  spellCheck={false}
                  autoFocus
                  aria-describedby={`${base}-edit-hint`}
                />
                <p id={`${base}-edit-hint`} className="hint">
                  {t.split.editHint}
                </p>
                <div className="button-row">
                  <button
                    type="button"
                    className="btn btn--secondary btn--compact"
                    onClick={() => apply(i)}
                  >
                    {t.split.apply}
                  </button>
                  <button
                    type="button"
                    className="btn btn--secondary btn--compact"
                    onClick={() => cancel(i)}
                  >
                    {t.split.cancel}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="split__text">
                  <span className="split__num" aria-hidden="true">
                    {i + 1}
                  </span>
                  {ref}
                </p>
                <div className="split__actions">
                  {i > 0 && (
                    <button
                      type="button"
                      className="btn btn--secondary btn--compact"
                      onClick={() => merge(i)}
                      aria-label={t.split.mergeLabel(i + 1)}
                    >
                      {t.split.merge}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn--secondary btn--compact"
                    onClick={() => startEdit(i)}
                    aria-label={t.split.editLabel(i + 1)}
                  >
                    {t.split.edit}
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ol>
      <p className="visually-hidden" role="status">
        {announcement}
      </p>
    </details>
  )
}
