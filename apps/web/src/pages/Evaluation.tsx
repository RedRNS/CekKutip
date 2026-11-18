import { EvaluationResults } from '../components/EvaluationResults'
import { usePageTitle } from '../hooks'
import { useI18n } from '../i18n'
import { useEvaluation } from '../lib/useEvaluation'

/**
 * Real results when eval/results/summary.json holds them. Otherwise the honest empty state:
 * no numbers, no charts, no sample tables. A summary made from template data is treated as absent.
 */
export default function Evaluation() {
  const { t } = useI18n()
  const evaluation = useEvaluation()
  usePageTitle('evaluation')

  return (
    <>
      <div className="page-head">
        <h1>{t.evaluation.h1}</h1>
        <p className="lede">{t.evaluation.lede}</p>
      </div>

      {evaluation.phase === 'loading' && (
        // Only seen when the page is opened from inside the app. A direct visit gets its state in the HTML.
        <div className="eval-loading" role="status">
          {t.evaluation.results.loading}
        </div>
      )}

      {evaluation.phase === 'empty' && (
        <section className="section empty-state" aria-labelledby="eval-empty-title">
          <h2 id="eval-empty-title">{t.evaluation.emptyTitle}</h2>
          <p className="empty-state__text">{t.evaluation.empty}</p>
          <p className="muted">{t.evaluation.emptyNote}</p>
        </section>
      )}

      {evaluation.phase === 'ready' && <EvaluationResults summary={evaluation.summary} />}

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
        <h2 id="metrics-title">
          {evaluation.phase === 'ready' ? t.evaluation.metricsTitleDone : t.evaluation.metricsTitle}
        </h2>
        <ul className="plain-list">
          {t.evaluation.metrics.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </section>
    </>
  )
}
