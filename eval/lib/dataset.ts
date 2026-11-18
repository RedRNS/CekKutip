import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { Verdict } from '@cekkutip/shared'
import { parseCsv } from './csv.js'

export const GOLD_LABELS: readonly Verdict[] = ['verified', 'mismatch', 'suspect', 'out_of_index']
export const SOURCE_TYPES = ['real', 'model_generated', 'perturbed'] as const
export type SourceType = (typeof SOURCE_TYPES)[number]
export type Split = 'dev' | 'test'

export const COLUMNS = [
  'id',
  'split',
  'reference_text',
  'gold_label',
  'source_type',
  'labeler1',
  'labeler2',
  'notes',
] as const

export interface DatasetRow {
  id: string
  split: Split
  text: string
  gold: Verdict
  sourceType: SourceType
  labeler1: Verdict | null
  labeler2: Verdict | null
  notes: string
}

/** What a system under evaluation is given. It has no label field, so labels cannot leak. */
export interface EvalInput {
  id: string
  text: string
}

export function toInputs(rows: DatasetRow[]): EvalInput[] {
  return rows.map((r) => ({ id: r.id, text: r.text }))
}

export interface Dataset {
  rows: DatasetRow[]
  file: string
  sha256: string
  /** True for the template file. Results from it are samples and must never be published. */
  sample: boolean
}

const isLabel = (v: string): v is Verdict => (GOLD_LABELS as readonly string[]).includes(v)

/** Parse and validate. Every problem is reported at once, with its line, instead of failing on the first. */
export function parseDataset(text: string): DatasetRow[] {
  const table = parseCsv(text)
  const header = (table[0] ?? []).map((h) => h.trim())
  const problems: string[] = []
  for (const col of COLUMNS) if (!header.includes(col)) problems.push(`missing column "${col}"`)
  if (problems.length) throw new Error(`Dataset header: ${problems.join('; ')}`)
  const at = (row: string[], col: (typeof COLUMNS)[number]) =>
    (row[header.indexOf(col)] ?? '').trim()

  const rows: DatasetRow[] = []
  const seen = new Set<string>()
  table.slice(1).forEach((r, i) => {
    const where = `row ${i + 1}`
    const id = at(r, 'id')
    const split = at(r, 'split')
    const text = at(r, 'reference_text')
    const gold = at(r, 'gold_label')
    const sourceType = at(r, 'source_type')
    const l1 = at(r, 'labeler1')
    const l2 = at(r, 'labeler2')
    if (id === '') problems.push(`${where}: empty id`)
    else if (seen.has(id)) problems.push(`${where}: duplicate id "${id}"`)
    seen.add(id)
    if (split !== 'dev' && split !== 'test')
      problems.push(`${where} (${id}): split must be dev or test`)
    if (text === '') problems.push(`${where} (${id}): empty reference_text`)
    if (!isLabel(gold))
      problems.push(`${where} (${id}): gold_label must be one of ${GOLD_LABELS.join(', ')}`)
    if (!(SOURCE_TYPES as readonly string[]).includes(sourceType)) {
      problems.push(`${where} (${id}): source_type must be one of ${SOURCE_TYPES.join(', ')}`)
    }
    for (const [name, v] of [
      ['labeler1', l1],
      ['labeler2', l2],
    ] as const) {
      if (v !== '' && !isLabel(v))
        problems.push(`${where} (${id}): ${name} must be a verdict or empty`)
    }
    rows.push({
      id,
      split: split as Split,
      text,
      gold: gold as Verdict,
      sourceType: sourceType as SourceType,
      labeler1: isLabel(l1) ? l1 : null,
      labeler2: isLabel(l2) ? l2 : null,
      notes: at(r, 'notes'),
    })
  })
  if (problems.length)
    throw new Error(`Dataset has ${problems.length} problem(s):\n  ${problems.join('\n  ')}`)
  return rows
}

export function loadDataset(file: string): Dataset {
  const text = readFileSync(file, 'utf8')
  return {
    rows: parseDataset(text),
    file,
    sha256: createHash('sha256').update(text).digest('hex'),
    sample: path.basename(file).includes('template'),
  }
}

export function bySplit(rows: DatasetRow[], split: Split | 'all'): DatasetRow[] {
  return split === 'all' ? rows : rows.filter((r) => r.split === split)
}
