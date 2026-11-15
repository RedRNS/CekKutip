import { Link } from 'react-router-dom'
import { fmt, useI18n } from '../i18n'
import { siteConfig } from '../site.config'

export function Footer() {
  const { t } = useI18n()
  return (
    <footer className="site-footer">
      <div className="container site-footer__inner">
        <div>
          <p>{t.footer.statement}</p>
          <p>{fmt(t.footer.builtBy, { team: siteConfig.teamName })}</p>
        </div>
        <ul className="site-footer__links">
          <li>
            <Link to="/privacy">{t.footer.privacy}</Link>
          </li>
        </ul>
      </div>
    </footer>
  )
}
