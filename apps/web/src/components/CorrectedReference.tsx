import type { MatchedRecord } from '@cekkutip/shared'
import { apaReference } from '@cekkutip/shared/apa'
import { Copy } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useI18n } from '../i18n'

/**
 * The reference written in APA 7 from the record that was found, with a button to copy it.
 * Fixed rules, no model: the text only holds what the record holds.
 */
export function CorrectedReference({ record }: { record: MatchedRecord }) {
  const { t } = useI18n()
  const [copied, setCopied] = useState<'idle' | 'ok' | 'failed'>('idle')
  const text = useMemo(() => apaReference(record), [record])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied('ok')
    } catch {
      setCopied('failed')
    }
  }

  return (
    <div className="corrected">
      <p className="label">{t.corrected.title}</p>
      <p className="corrected__text">{text}</p>
      <p className="evidence__note">{t.corrected.note}</p>
      <div className="evidence__actions">
        <button type="button" className="btn btn--secondary" onClick={() => void copy()}>
          <Copy size={16} aria-hidden="true" />
          <span>{t.corrected.copy}</span>
        </button>
        <span className="export-row__status" role="status">
          {copied === 'ok' ? t.corrected.copied : copied === 'failed' ? t.corrected.copyFailed : ''}
        </span>
      </div>
    </div>
  )
}
