import type { Verdict } from '@cekkutip/shared'
import { useI18n } from '../i18n'
import { VerdictLabel } from './VerdictLabel'

export const VERDICT_ORDER: Verdict[] = ['verified', 'mismatch', 'suspect', 'out_of_index']

/** Definition list of the four verdicts, shown in the empty results panel. */
export function Legend() {
  const { t } = useI18n()
  return (
    <dl className="legend">
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
