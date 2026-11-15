import type { CheckStatus } from '@cekkutip/shared'
import { diffAgainst } from '../lib/diff'

export type FieldName = 'title' | 'authors' | 'year' | 'venue' | 'doi'
export type FieldState = 'agree' | 'differs' | 'not_cited' | 'not_found'

export interface FieldRow {
  field: FieldName
  cited: string | null
  found: string | null
  state: FieldState
  /** Replaces the plain state text, for example "differs by 2". */
  note?: string | null
}

export interface FieldTableLabels {
  caption: string
  field: string
  cited: string
  found: string
  status: string
  fields: Record<FieldName, string>
  states: Record<FieldState, string>
}

function toneClass(tone: CheckStatus): string {
  return `tone-${tone === 'out_of_index' ? 'oui' : tone}`
}

function Words({
  text,
  other,
  mono,
  mark,
}: {
  text: string | null
  other: string | null
  mono: boolean
  mark: boolean
}) {
  if (text === null) return <span className="field-table__none">&mdash;</span>
  const segments = mark ? diffAgainst(text, other) : [{ text, differs: false }]
  return (
    <span className={mono ? 'mono' : undefined}>
      {segments.map((s, i) =>
        s.differs ? (
          <span className="diff" key={i}>
            {s.text}
          </span>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </span>
  )
}

/**
 * Two-column comparison, styled like a proof-reader's correction: words that differ are underlined
 * (2px, in the verdict color) and the status column always says so in text.
 */
export function FieldTable({
  rows,
  labels,
  tone,
}: {
  rows: FieldRow[]
  labels: FieldTableLabels
  tone: CheckStatus
}) {
  return (
    <table className={`field-table ${toneClass(tone)}`}>
      <caption className="visually-hidden">{labels.caption}</caption>
      <thead>
        <tr>
          <th scope="col">{labels.field}</th>
          <th scope="col">{labels.cited}</th>
          <th scope="col">{labels.found}</th>
          <th scope="col">{labels.status}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const mono = r.field === 'doi'
          const mark = r.state === 'differs'
          return (
            <tr key={r.field}>
              <th scope="row">{labels.fields[r.field]}</th>
              <td data-label={labels.cited}>
                <Words text={r.cited} other={r.found} mono={mono} mark={mark} />
              </td>
              <td data-label={labels.found}>
                <Words text={r.found} other={r.cited} mono={mono} mark={mark} />
              </td>
              <td data-label={labels.status} className={`field-table__state is-${r.state}`}>
                {r.note ?? labels.states[r.state]}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
