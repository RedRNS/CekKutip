import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { PLACEHOLDER_EXAMPLES } from '../data/example-list'
import { useI18n } from '../i18n'
import { countReferences } from '../lib/count'
import { Legend } from './Legend'

/**
 * Static shell until M4: input and the live count work, the Check button is not wired yet.
 * Left: input. Right: results (empty state with the legend).
 */
export function Workbench() {
  const { t } = useI18n()
  const [text, setText] = useState('')
  const [noAi, setNoAi] = useState(false)
  const inputId = useId()
  const noteId = useId()
  const count = countReferences(text)
  const hasText = text.trim() !== ''

  return (
    <div className="workbench">
      <section className="panel panel--input" aria-labelledby={`${inputId}-label`}>
        <div className="panel__row">
          <label className="field-label" id={`${inputId}-label`} htmlFor={inputId}>
            {t.home.inputLabel}
          </label>
          <span className="count">{t.home.found(count)}</span>
        </div>
        <textarea
          id={inputId}
          className="textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={PLACEHOLDER_EXAMPLES.join('\n\n')}
          spellCheck={false}
          aria-describedby={noteId}
        />
        <p id={noteId} className="hint">
          {t.home.placeholderHint}
        </p>

        <label className="check-row">
          <input type="checkbox" checked={noAi} onChange={(e) => setNoAi(e.target.checked)} />
          <span>{t.home.noAi}</span>
        </label>

        <p className="notice">
          {t.home.notice} <Link to="/privacy">{t.home.noticeLink}</Link>
        </p>

        <div className="button-row">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => setText(PLACEHOLDER_EXAMPLES.join('\n\n'))}
          >
            {t.home.example}
          </button>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => setText('')}
            disabled={!hasText}
          >
            {t.home.clear}
          </button>
        </div>

        <div className={hasText ? 'check-bar check-bar--sticky' : 'check-bar'}>
          <button type="button" className="btn btn--primary" disabled>
            {t.home.check}
          </button>
        </div>
      </section>

      <section className="panel panel--results" aria-labelledby="results-title">
        <h2 id="results-title" className="panel__title">
          {t.home.resultsTitle}
        </h2>
        <div className="results-empty">
          <p>{t.home.emptyHint}</p>
          <h3 className="results-empty__legend-title">{t.home.emptyLegend}</h3>
          <Legend />
        </div>
        <p className="results-statement">{t.home.statement}</p>
      </section>
    </div>
  )
}
