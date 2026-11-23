import { NavLink } from 'react-router-dom'
import { useI18n } from '../i18n'
import { LangSwitch } from './LangSwitch'

export function Header() {
  const { t } = useI18n()
  const items = [
    { to: '/', label: t.nav.check, end: true },
    { to: '/format', label: t.nav.format },
    { to: '/how-it-works', label: t.nav.how },
    { to: '/evaluation', label: t.nav.evaluation },
    { to: '/extension', label: t.nav.extension },
    { to: '/about', label: t.nav.about },
  ]

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
        <LangSwitch />
      </div>
    </header>
  )
}
