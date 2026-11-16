import type { ReferenceResult } from '@cekkutip/shared'
import { ChevronDown } from 'lucide-react'
import { useId, useState } from 'react'
import { useI18n } from '../i18n'
import { reasonText } from '../lib/report'
import { EvidencePanel } from './EvidencePanel'
import { VerdictLabel } from './VerdictLabel'

const pad = (n: number) => String(n).padStart(2, '0')

/** A reference that has not come back yet: its text, and the word "Checking". */
export function PendingRow({ index, text }: { index: number; text: string }) {
  const { t } = useI18n()
  return (
    <li className="row row--pending">
      <div className="row__head">
        <span className="row__num">{pad(index + 1)}</span>
        <div className="row__main">
          <p className="row__raw row__raw--clamp">{text}</p>
          <p className="row__checking">{t.results.checking}</p>
        </div>
      </div>
    </li>
  )
}

export function ResultRow({ result }: { result: ReferenceResult }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const n = result.index + 1
  const tone = result.status === 'out_of_index' ? 'oui' : result.status

  return (
    <li className={`row row--${tone}`}>
      <div className="row__head">
        <span className="row__num">{pad(n)}</span>
        <div className="row__main">
          <p className={open ? 'row__raw' : 'row__raw row__raw--clamp'}>{result.raw}</p>
          <div className="row__meta">
            <VerdictLabel status={result.status} />
            <span className="row__reason">{reasonText(result, t)}</span>
          </div>
        </div>
        <button
          type="button"
          className="row__toggle"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
        >
          <ChevronDown size={20} aria-hidden="true" className="row__chevron" />
          <span className="visually-hidden">
            {open ? t.results.hideDetails(n) : t.results.showDetails(n)}
          </span>
        </button>
      </div>
      {open && <EvidencePanel result={result} id={panelId} />}
    </li>
  )
}
