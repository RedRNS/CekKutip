import type { CheckStatus } from '@cekkutip/shared'
import { useI18n } from '../i18n'

/**
 * Hand-drawn 16px glyphs. Each verdict has a different silhouette so it reads without color:
 * circle + check, diamond + two shifted bars, triangle + exclamation, dashed square + dash.
 */
export function VerdictGlyph({ status }: { status: CheckStatus }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    'aria-hidden': true,
    focusable: false,
    className: 'verdict__glyph',
  } as const

  switch (status) {
    case 'verified':
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6.25" />
          <path d="M4.8 8.3l2.2 2.2 4.3-4.7" strokeLinecap="square" />
        </svg>
      )
    case 'mismatch':
      return (
        <svg {...common}>
          <path d="M8 1.6L14.4 8 8 14.4 1.6 8z" strokeLinejoin="miter" />
          <path d="M4.6 6.6h4.2M7.2 9.4h4.2" strokeLinecap="square" />
        </svg>
      )
    case 'suspect':
      return (
        <svg {...common}>
          <path d="M8 2L14.6 13.6H1.4z" strokeLinejoin="miter" />
          <path d="M8 6.3v3.2" strokeLinecap="square" />
          <path d="M8 11.4v.2" strokeLinecap="square" />
        </svg>
      )
    case 'out_of_index':
      return (
        <svg {...common}>
          <rect x="2" y="2" width="12" height="12" strokeDasharray="2.6 1.8" />
          <path d="M5.2 8h5.6" strokeLinecap="square" />
        </svg>
      )
    case 'check_failed':
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6.25" strokeDasharray="1.2 2.2" />
          <path d="M8 8h.01" strokeLinecap="round" />
        </svg>
      )
  }
}

export function VerdictLabel({ status }: { status: CheckStatus }) {
  const { t } = useI18n()
  const cls = status === 'out_of_index' ? 'oui' : status
  return (
    <span className={`verdict verdict--${cls}`}>
      <VerdictGlyph status={status} />
      <span>{t.verdict[status]}</span>
    </span>
  )
}
