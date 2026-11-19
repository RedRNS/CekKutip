import { useI18n } from '../i18n'
import type { Lang } from '../i18n'

const LANGS: Lang[] = ['en', 'id']

/** The EN | ID switch. Used by the site header and by the extension's side panel. */
export function LangSwitch() {
  const { t, lang, setLang } = useI18n()
  return (
    <div className="lang-switch" role="group" aria-label={t.nav.language}>
      {LANGS.map((l, idx) => (
        <span key={l} className="lang-switch__part">
          {idx > 0 && (
            <span className="lang-switch__sep" aria-hidden="true">
              |
            </span>
          )}
          <button
            type="button"
            className="lang-switch__btn"
            lang={l}
            aria-pressed={lang === l}
            // The accessible name starts with the visible text ("EN"), as WCAG 2.5.3 (Label in Name) asks.
            aria-label={`${l.toUpperCase()}: ${t.nav.switchTo[l]}`}
            onClick={() => setLang(l)}
          >
            {l.toUpperCase()}
          </button>
        </span>
      ))}
    </div>
  )
}
