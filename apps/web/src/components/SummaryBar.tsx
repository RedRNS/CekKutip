import type { CheckStatus } from '@cekkutip/shared'
import { useId } from 'react'
import { STATUS_ORDER } from '../state/check'
import type { Counts } from '../state/check'
import { useI18n } from '../i18n'
import { VerdictGlyph } from './VerdictLabel'

export type Filter = CheckStatus | 'all'

interface Props {
  counts: Counts
  total: number
  filter: Filter
  onFilter: (filter: Filter) => void
}

const cls = (s: CheckStatus) => (s === 'out_of_index' ? 'oui' : s)

/**
 * One 12px bar divided by verdict, with a pattern per verdict so it reads without color:
 * Verified solid, Mismatch diagonal lines, Suspect dense dots, Out-of-index a dashed box.
 * Below it, the same numbers as text. Those buttons are the accessible filter; the bar is a
 * mouse shortcut and is hidden from screen readers.
 * Sizes are SVG attributes in percent, so no inline style is needed (strict CSP).
 */
export function SummaryBar({ counts, total, filter, onFilter }: Props) {
  const { t } = useI18n()
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const received = STATUS_ORDER.reduce((n, s) => n + counts[s], 0)
  const toggle = (s: CheckStatus) => onFilter(filter === s ? 'all' : s)

  let offset = 0
  const segments = STATUS_ORDER.filter((s) => counts[s] > 0).map((s) => {
    const width = (counts[s] / Math.max(1, total)) * 100
    const seg = { status: s, x: offset, width }
    offset += width
    return seg
  })

  return (
    <div className="summary">
      <svg className="summary__bar" width="100%" height="12" aria-hidden="true" focusable="false">
        <defs>
          <pattern id={`${uid}-diag`} width="6" height="6" patternUnits="userSpaceOnUse">
            <rect className="sb-tint--mismatch" width="6" height="6" />
            <path className="sb-line--mismatch" d="M-1 1l2-2M0 6l6-6M5 7l2-2" />
          </pattern>
          <pattern id={`${uid}-dots`} width="4" height="4" patternUnits="userSpaceOnUse">
            <rect className="sb-tint--suspect" width="4" height="4" />
            <circle className="sb-dot--suspect" cx="2" cy="2" r="1.15" />
          </pattern>
        </defs>
        <rect className="sb-track" x="0" y="0" width="100%" height="12" />
        {segments.map((seg) => (
          <g key={seg.status} className="sb-seg" onClick={() => toggle(seg.status)}>
            <rect
              className={`sb-fill sb-fill--${cls(seg.status)}`}
              x={`${seg.x}%`}
              y="0.75"
              width={`${seg.width}%`}
              height="10.5"
              fill={
                seg.status === 'mismatch'
                  ? `url(#${uid}-diag)`
                  : seg.status === 'suspect'
                    ? `url(#${uid}-dots)`
                    : undefined
              }
            />
            {/* a 2px gap in the surface color separates neighbours */}
            <rect className="sb-gap" x={`${seg.x + seg.width}%`} y="0" width="2" height="12" />
          </g>
        ))}
      </svg>

      <div className="filters" role="group" aria-label={t.results.filterLabel}>
        <button
          type="button"
          className="filter"
          aria-pressed={filter === 'all'}
          onClick={() => onFilter('all')}
        >
          <span>{t.results.all}</span>
          <span className="filter__count">{received}</span>
        </button>
        {STATUS_ORDER.filter((s) => s !== 'check_failed' || counts[s] > 0).map((s) => (
          <button
            key={s}
            type="button"
            className={`filter filter--${cls(s)}`}
            aria-pressed={filter === s}
            onClick={() => toggle(s)}
          >
            <VerdictGlyph status={s} />
            <span>{t.verdict[s]}</span>
            <span className="filter__count">{counts[s]}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
