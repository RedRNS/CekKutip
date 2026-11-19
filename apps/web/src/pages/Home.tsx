import { Link } from 'react-router-dom'
import { Legend } from '../components/Legend'
import { Workbench } from '../components/Workbench'
import { usePageTitle } from '../hooks'
import { useI18n } from '../i18n'

export default function Home() {
  const { t } = useI18n()
  usePageTitle('home')

  return (
    <>
      <div className="page-head print-hide">
        <h1>{t.home.h1}</h1>
        <p className="lede">{t.home.intro}</p>
      </div>

      <Workbench />

      <section className="section print-hide" aria-labelledby="verdicts-title">
        <h2 id="verdicts-title">{t.home.verdictsTitle}</h2>
        <Legend className="legend--columns" />
      </section>

      <section className="section print-hide" aria-labelledby="how-title">
        <h2 id="how-title">{t.home.howTitle}</h2>
        <ol className="steps">
          {t.home.steps.map((s, i) => (
            <li key={s.name} className="steps__item">
              <span className="steps__num" aria-hidden="true">
                {i + 1}
              </span>
              <h3>
                <span className="visually-hidden">{i + 1} </span>
                {s.name}
              </h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
        <p className="section__more">
          <Link to="/how-it-works">{t.home.howMore}</Link>
        </p>
      </section>

      <section className="section print-hide" aria-labelledby="ext-title">
        <h2 id="ext-title">{t.home.extTitle}</h2>
        <p>{t.home.extText}</p>
        <p className="section__more">
          <Link className="btn btn--secondary" to="/extension">
            {t.home.extLink}
          </Link>
        </p>
      </section>

      <section className="section print-hide" aria-labelledby="not-title">
        <h2 id="not-title">{t.home.notTitle}</h2>
        <ul className="plain-list">
          {t.home.notItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </>
  )
}
