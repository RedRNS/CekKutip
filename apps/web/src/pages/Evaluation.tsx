import { usePageTitle } from '../hooks'
import { useI18n } from '../i18n'

/**
 * M1: honest empty state only. No numbers, charts, or sample tables.
 * TODO(M6): read eval/results/summary.json (via GET /api/evaluation) and render real results when it exists.
 */
export default function Evaluation() {
  const { t } = useI18n()
  usePageTitle('evaluation')

  return (
    <>
      <div className="page-head">
        <h1>{t.evaluation.h1}</h1>
        <p className="lede">{t.evaluation.lede}</p>
      </div>

      <section className="section empty-state" aria-labelledby="eval-empty-title">
        <h2 id="eval-empty-title">{t.evaluation.emptyTitle}</h2>
        <p className="empty-state__text">{t.evaluation.empty}</p>
        <p className="muted">{t.evaluation.emptyNote}</p>
      </section>

      <div className="two-col">
        <section className="section" aria-labelledby="tech-title">
          <h2 id="tech-title">{t.evaluation.technicalTitle}</h2>
          <p>{t.evaluation.technical}</p>
        </section>
        <section className="section" aria-labelledby="user-title">
          <h2 id="user-title">{t.evaluation.userTitle}</h2>
          <p>{t.evaluation.user}</p>
        </section>
      </div>

      <section className="section" aria-labelledby="metrics-title">
        <h2 id="metrics-title">{t.evaluation.metricsTitle}</h2>
        <ul className="plain-list">
          {t.evaluation.metrics.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </section>
    </>
  )
}
