import { usePageTitle } from '../hooks'
import { useI18n } from '../i18n'

export default function Privacy() {
  const { t } = useI18n()
  usePageTitle('privacy')

  return (
    <>
      <div className="page-head">
        <h1>{t.privacy.h1}</h1>
        <p className="lede">{t.privacy.lede}</p>
      </div>

      <section className="section">
        <ul className="plain-list plain-list--spaced">
          {t.privacy.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="section__more">
          <a href="https://ai.google.dev/gemini-api/terms">{t.privacy.googleTerms}</a>
        </p>
      </section>
    </>
  )
}
