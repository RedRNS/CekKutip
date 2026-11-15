import { Link } from 'react-router-dom'
import { usePageTitle } from '../hooks'
import { useI18n } from '../i18n'

export default function NotFound() {
  const { t } = useI18n()
  usePageTitle('notFound')
  return (
    <div className="page-head">
      <h1>{t.notFound.h1}</h1>
      <p className="lede">{t.notFound.text}</p>
      <p className="section__more">
        <Link to="/">{t.notFound.link}</Link>
      </p>
    </div>
  )
}
