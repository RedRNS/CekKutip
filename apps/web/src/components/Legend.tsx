import type { Verdict } from '@cekkutip/shared'
import { useI18n } from '../i18n'
import { VerdictLabel } from './VerdictLabel'

export const VERDICT_ORDER: Verdict[] = ['verified', 'mismatch', 'suspect', 'out_of_index']

/** Definition list of the four verdicts. Used in the empty results panel and below the workbench. */
export function Legend({ className = '' }: { className?: string }) {
  const { t } = useI18n()
  return (
    <dl className={`legend ${className}`.trim()}>
      {VERDICT_ORDER.map((v) => (
        <div className="legend__item" key={v}>
          <dt>
            <VerdictLabel status={v} />
          </dt>
          <dd>{t.verdictDefinitions[v]}</dd>
        </div>
      ))}
    </dl>
  )
}
