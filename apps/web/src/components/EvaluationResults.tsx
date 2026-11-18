import type { EvaluationRun, EvaluationSummary, ScoredValue } from '@cekkutip/shared/evaluation'
import { VERDICT_NAMES } from '@cekkutip/shared/evaluation'
import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { useI18n } from '../i18n'
import { datasetSize, groupBySplit, numberFormatter, signedChange } from '../lib/evaluationView'

/** A table that scrolls inside its own box on small screens, reachable and scrollable by keyboard. */
function DataTable({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div className="table-scroll" role="region" aria-label={caption} tabIndex={0}>
      <table className="data-table">
        <caption className="visually-hidden">{caption}</caption>
        {children}
      </table>
    </div>
  )
}

/**
 * The evaluation results. Every number on this page comes from summary.json, formatted only.
 * Nothing is computed here, and nothing is shown that the file does not contain.
 */
export function EvaluationResults({ summary }: { summary: EvaluationSummary }) {
  const { t, lang } = useI18n()
  const r = t.evaluation.results
  const f = useMemo(() => numberFormatter(lang), [lang])
  const f0 = useMemo(() => numberFormatter(lang, 0), [lang])
  const na = r.notAvailable
  const groups = useMemo(() => groupBySplit(summary), [summary])

  const named = (run: EvaluationRun) =>
    run.ablation ? (r.ablations[run.ablation] ?? run.name) : (r.systems[run.system] ?? run.name)
  const withInterval = (s: { value: number | null; ci95: [number, number] | null }) =>
    s.value === null ? na : s.ci95 ? `${f(s.value)} [${f(s.ci95[0])}, ${f(s.ci95[1])}]` : f(s.value)
  const interval = (s: ScoredValue) => withInterval(s)
  const splitName = (split: string) => r.splits[split] ?? split

  const dataset = summary.datasetSha256.length === 1 ? summary.datasetSha256[0]?.slice(0, 12) : null
  const nData = datasetSize(summary)
  const when = new Date(summary.generatedAt)
  const date = Number.isNaN(when.getTime()) ? summary.generatedAt : when.toISOString().slice(0, 10)
  const th = summary.thresholds

  return (
    <div className="eval-results">
      <section className="section" aria-labelledby="eval-facts-title">
        <h2 id="eval-facts-title">{r.factsTitle}</h2>
        <dl className="facts">
          <div>
            <dt>{r.version}</dt>
            <dd>{summary.toolVersion ?? na}</dd>
          </div>
          <div>
            <dt>{r.commit}</dt>
            <dd className="mono">
              {summary.commit ?? na}
              {summary.uncommittedChanges ? ` (${r.uncommitted})` : ''}
            </dd>
          </div>
          <div>
            <dt>{r.model}</dt>
            <dd>{summary.model ?? r.noModel}</dd>
          </div>
          <div>
            <dt>{r.date}</dt>
            <dd>{date}</dd>
          </div>
          {th && (
            <div>
              <dt>{r.cutoffs}</dt>
              <dd>
                <span className="mono">
                  TAU_T {th.tauT}, TAU_A {th.tauA}, TAU_L {th.tauL}, TAU_V {th.tauV}
                </span>{' '}
                ({r.cutoffsSource})
              </dd>
            </div>
          )}
          {summary.bootstrap && (
            <div>
              <dt>{r.intervals}</dt>
              <dd>{r.intervalsText(summary.bootstrap.resamples, summary.bootstrap.seed)}</dd>
            </div>
          )}
          <div>
            <dt>{r.dataset}</dt>
            <dd>
              {r.datasetText(nData)}
              {dataset && <span className="mono"> {dataset}</span>}
            </dd>
          </div>
        </dl>
      </section>

      {groups.map((g) => (
        <section key={g.split} className="section" aria-labelledby={`eval-${g.split}`}>
          <h2 id={`eval-${g.split}`}>{splitName(g.split)}</h2>

          <h3 className="eval-h3">{r.mainTitle}</h3>
          <DataTable caption={r.mainCaption(splitName(g.split))}>
            <thead>
              <tr>
                <th scope="col">{r.run}</th>
                <th scope="col" className="num">
                  {r.n}
                </th>
                <th scope="col" className="num">
                  {r.macroF1}
                </th>
                <th scope="col" className="num">
                  {r.falseAccusation}
                </th>
                <th scope="col" className="num">
                  {r.abstain}
                </th>
                <th scope="col" className="num">
                  {r.couldNotCheck}
                </th>
              </tr>
            </thead>
            <tbody>
              {g.runs.map((run) => (
                <tr key={run.name}>
                  <th scope="row">{named(run)}</th>
                  <td className="num">{f0(run.n)}</td>
                  <td className="num">{interval(run.macroF1)}</td>
                  <td className="num">
                    {withInterval(run.falseAccusationRate)}
                    <span className="subtle">
                      {' '}
                      {r.falseAccusationOf(run.falseAccusationRate.outOf)}
                    </span>
                  </td>
                  <td className="num">{interval(run.abstainRate)}</td>
                  <td className="num">{f0(run.checkFailed)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>

          <h3 className="eval-h3">{r.timeTitle}</h3>
          <DataTable caption={r.timeCaption(splitName(g.split))}>
            <thead>
              <tr>
                <th scope="col">{r.run}</th>
                <th scope="col" className="num">
                  {r.latency}
                </th>
                <th scope="col" className="num">
                  {r.cost}
                </th>
              </tr>
            </thead>
            <tbody>
              {g.runs.map((run) => (
                <tr key={run.name}>
                  <th scope="row">{named(run)}</th>
                  <td className="num">{f0(run.medianLatencyMs)}</td>
                  <td className="num">
                    {run.costPer1000Usd === null ? na : f(run.costPer1000Usd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          <p className="muted eval-note">{r.latencyNote}</p>

          <h3 className="eval-h3">{r.f1Title}</h3>
          <DataTable caption={r.f1Caption(splitName(g.split))}>
            <thead>
              <tr>
                <th scope="col">{r.run}</th>
                {VERDICT_NAMES.map((v) => (
                  <th key={v} scope="col" className="num">
                    {t.verdict[v]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {g.runs.map((run) => (
                <tr key={run.name}>
                  <th scope="row">{named(run)}</th>
                  {VERDICT_NAMES.map((v) => (
                    <td key={v} className="num">
                      {f(run.f1[v])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </DataTable>

          <h3 className="eval-h3">{r.binaryTitle}</h3>
          <p className="muted eval-note">{r.binaryText}</p>
          <DataTable caption={r.binaryCaption(splitName(g.split))}>
            <thead>
              <tr>
                <th scope="col">{r.run}</th>
                <th scope="col" className="num">
                  {r.precision}
                </th>
                <th scope="col" className="num">
                  {r.recall}
                </th>
                <th scope="col" className="num">
                  {r.f1}
                </th>
                <th scope="col" className="num">
                  {r.accuracy}
                </th>
              </tr>
            </thead>
            <tbody>
              {g.runs.map((run) => (
                <tr key={run.name}>
                  <th scope="row">{named(run)}</th>
                  <td className="num">{f(run.binaryVerified.precision)}</td>
                  <td className="num">{f(run.binaryVerified.recall)}</td>
                  <td className="num">{f(run.binaryVerified.f1)}</td>
                  <td className="num">{f(run.binaryVerified.accuracy)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>

          {g.base && g.ablations.length > 0 && (
            <>
              <h3 className="eval-h3">{r.ablationTitle}</h3>
              <p className="muted eval-note">{r.ablationText}</p>
              <DataTable caption={r.ablationCaption(splitName(g.split))}>
                <thead>
                  <tr>
                    <th scope="col">{r.run}</th>
                    <th scope="col" className="num">
                      {r.macroF1}
                    </th>
                    <th scope="col" className="num">
                      {r.change}
                    </th>
                    <th scope="col" className="num">
                      {r.falseAccusation}
                    </th>
                    <th scope="col" className="num">
                      {r.change}
                    </th>
                    <th scope="col" className="num">
                      {r.abstain}
                    </th>
                    <th scope="col" className="num">
                      {r.change}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[g.base, ...g.ablations].map((run) => {
                    const base = g.base as EvaluationRun
                    const isBase = run === base
                    return (
                      <tr key={run.name}>
                        <th scope="row">{named(run)}</th>
                        <td className="num">{f(run.macroF1.value)}</td>
                        <td className="num">
                          {isBase ? '' : signedChange(run.macroF1.value, base.macroF1.value, f)}
                        </td>
                        <td className="num">
                          {run.falseAccusationRate.value === null
                            ? na
                            : f(run.falseAccusationRate.value)}
                        </td>
                        <td className="num">
                          {isBase
                            ? ''
                            : signedChange(
                                run.falseAccusationRate.value,
                                base.falseAccusationRate.value,
                                f,
                              )}
                        </td>
                        <td className="num">{f(run.abstainRate.value)}</td>
                        <td className="num">
                          {isBase
                            ? ''
                            : signedChange(run.abstainRate.value, base.abstainRate.value, f)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </DataTable>
            </>
          )}

          {g.runs.some((x) => x.withoutPerturbed) && (
            <>
              <h3 className="eval-h3">{r.syntheticTitle}</h3>
              <p className="muted eval-note">{r.syntheticText}</p>
              <DataTable caption={r.syntheticCaption(splitName(g.split))}>
                <thead>
                  <tr>
                    <th scope="col">{r.run}</th>
                    <th scope="col" className="num">
                      {r.altered}
                    </th>
                    <th scope="col" className="num">
                      {r.macroF1} ({r.withAll})
                    </th>
                    <th scope="col" className="num">
                      {r.macroF1} ({r.withoutAltered})
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {g.runs
                    .filter((x) => x.withoutPerturbed)
                    .map((run) => (
                      <tr key={run.name}>
                        <th scope="row">{named(run)}</th>
                        <td className="num">{f0(run.perturbedItems)}</td>
                        <td className="num">{interval(run.macroF1)}</td>
                        <td className="num">
                          {interval(
                            (run.withoutPerturbed as NonNullable<EvaluationRun['withoutPerturbed']>)
                              .macroF1,
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </DataTable>
            </>
          )}
        </section>
      ))}

      {summary.kappa && (
        <section className="section" aria-labelledby="eval-kappa">
          <h2 id="eval-kappa">{r.kappaTitle}</h2>
          <p>
            {r.kappaText(
              summary.kappa.kappa === null ? na : f(summary.kappa.kappa),
              summary.kappa.n,
              summary.kappa.observed === null ? na : f(summary.kappa.observed),
              summary.kappa.expected === null ? na : f(summary.kappa.expected),
            )}
            {summary.kappa.skipped > 0 && ` ${r.kappaSkipped(summary.kappa.skipped)}`}
          </p>
          <DataTable caption={r.kappaCaption}>
            <thead>
              <tr>
                <th scope="col">{r.labeler1}</th>
                {VERDICT_NAMES.map((v) => (
                  <th key={v} scope="col" className="num">
                    {t.verdict[v]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {VERDICT_NAMES.map((a) => (
                <tr key={a}>
                  <th scope="row">{t.verdict[a]}</th>
                  {VERDICT_NAMES.map((b) => (
                    <td key={b} className="num">
                      {f0(summary.kappa?.matrix[a][b])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </DataTable>
        </section>
      )}
    </div>
  )
}
