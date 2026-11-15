import { NavLink } from 'react-router-dom'
import { useI18n } from '../i18n'
import type { Lang } from '../i18n'

export function Header() {
  const { t, lang, setLang } = useI18n()
  const items = [
    { to: '/', label: t.nav.check, end: true },
    { to: '/how-it-works', label: t.nav.how },
    { to: '/evaluation', label: t.nav.evaluation },
    { to: '/about', label: t.nav.about },
  ]
  const langs: Lang[] = ['en', 'id']

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <NavLink to="/" className="wordmark" end>
          CekKutip
        </NavLink>
        <nav className="site-nav" aria-label={t.nav.label}>
          <ul>
            {items.map((i) => (
              <li key={i.to}>
                <NavLink to={i.to} end={i.end}>
                  {i.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="lang-switch" role="group" aria-label={t.nav.language}>
          {langs.map((l, idx) => (
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
                aria-label={t.nav.switchTo[l]}
                onClick={() => setLang(l)}
              >
                {l.toUpperCase()}
              </button>
            </span>
          ))}
        </div>
      </div>
    </header>
  )
}
