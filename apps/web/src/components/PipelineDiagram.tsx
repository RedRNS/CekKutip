import { useI18n } from '../i18n'

const NODE_W = 236
const STEP_X = 288

/** Hand-drawn pipeline: Parse (language model) then three fixed-code steps. Two layouts, one per breakpoint. */
export function PipelineDiagram() {
  const { t } = useI18n()
  const steps = t.how.diagramSteps

  return (
    <figure className="pipeline">
      <svg
        className="pipeline__svg pipeline__svg--wide"
        viewBox="0 0 1100 176"
        role="img"
        aria-labelledby="pd-title-wide pd-desc-wide"
      >
        <title id="pd-title-wide">{t.how.diagramTitle}</title>
        <desc id="pd-desc-wide">{t.how.diagramDesc}</desc>
        {steps.map((s, i) => {
          const x = i * STEP_X
          const model = i === 0
          return (
            <g key={s.name} transform={`translate(${x} 8)`}>
              <rect
                className={model ? 'pd-node pd-node--model' : 'pd-node'}
                width={NODE_W}
                height={146}
                rx="4"
              />
              <text className="pd-num" x="18" y="36">
                {String(i + 1).padStart(2, '0')}
              </text>
              <text className="pd-name" x="18" y="72">
                {s.name}
              </text>
              <text className="pd-note" x="18" y="98">
                {s.note}
              </text>
              <line
                className={model ? 'pd-rule pd-rule--model' : 'pd-rule'}
                x1="18"
                x2={NODE_W - 18}
                y1="114"
                y2="114"
              />
              <text className={model ? 'pd-tag pd-tag--model' : 'pd-tag'} x="18" y="134">
                {s.tag}
              </text>
              {i < steps.length - 1 && (
                <g className="pd-arrow" transform={`translate(${NODE_W} 73)`}>
                  <line x1="6" y1="0" x2={STEP_X - NODE_W - 8} y2="0" />
                  <path
                    d={`M${STEP_X - NODE_W - 16} -6 L${STEP_X - NODE_W - 6} 0 L${STEP_X - NODE_W - 16} 6`}
                  />
                </g>
              )}
            </g>
          )
        })}
      </svg>

      <svg
        className="pipeline__svg pipeline__svg--narrow"
        viewBox="0 0 360 612"
        role="img"
        aria-labelledby="pd-title-narrow pd-desc-narrow"
      >
        <title id="pd-title-narrow">{t.how.diagramTitle}</title>
        <desc id="pd-desc-narrow">{t.how.diagramDesc}</desc>
        {steps.map((s, i) => {
          const y = i * 156 + 4
          const model = i === 0
          return (
            <g key={s.name} transform={`translate(2 ${y})`}>
              <rect
                className={model ? 'pd-node pd-node--model' : 'pd-node'}
                width="356"
                height="118"
                rx="4"
              />
              <text className="pd-num" x="16" y="30">
                {String(i + 1).padStart(2, '0')}
              </text>
              <text className="pd-name" x="16" y="60">
                {s.name}
              </text>
              <text className="pd-note" x="16" y="84">
                {s.note}
              </text>
              <text className={model ? 'pd-tag pd-tag--model' : 'pd-tag'} x="16" y="106">
                {s.tag}
              </text>
              {i < steps.length - 1 && (
                <g className="pd-arrow" transform="translate(178 118)">
                  <line x1="0" y1="4" x2="0" y2="32" />
                  <path d="M-6 26 L0 34 L6 26" />
                </g>
              )}
            </g>
          )
        })}
      </svg>
      <figcaption>{t.how.diagramNote}</figcaption>
    </figure>
  )
}
