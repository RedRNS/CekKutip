import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseCsv, toCsv } from '../lib/csv.js'
import { COLUMNS, bySplit, loadDataset, parseDataset, toInputs } from '../lib/dataset.js'
import { TEMPLATE_DATA } from '../lib/harness.js'

describe('parseCsv', () => {
  it('reads plain and quoted cells, including commas, quotes, and line breaks inside quotes', () => {
    const rows = parseCsv('a,b,c\n1,"x, y","say ""hi"""\n2,"line\nbreak",z\n')
    expect(rows).toEqual([
      ['a', 'b', 'c'],
      ['1', 'x, y', 'say "hi"'],
      ['2', 'line\nbreak', 'z'],
    ])
  })

  it('accepts Windows line endings, a byte order mark, and a missing final newline', () => {
    const bom = String.fromCharCode(0xfeff)
    expect(parseCsv(`${bom}a,b\r\n1,2`)).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('skips blank lines and comment lines that start with #', () => {
    expect(parseCsv('# note\n\na,b\n# another\n1,2\n\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('keeps empty cells', () => {
    expect(parseCsv('a,b,c\n1,,3\n,,\n')).toEqual([
      ['a', 'b', 'c'],
      ['1', '', '3'],
      ['', '', ''],
    ])
  })

  it('round-trips through toCsv', () => {
    const rows = [
      ['id', 'text'],
      ['1', 'has, comma'],
      ['2', 'has "quote"'],
      ['3', 'two\nlines'],
    ]
    expect(parseCsv(toCsv(rows))).toEqual(rows)
  })
})

describe('the template data file', () => {
  const dataset = loadDataset(TEMPLATE_DATA)

  it('is valid and is marked as sample data', () => {
    expect(dataset.sample).toBe(true)
    expect(dataset.rows).toHaveLength(12)
    expect(dataset.sha256).toMatch(/^[0-9a-f]{64}$/)
  })

  it('has both splits and every gold label, so the harness can be tried end to end', () => {
    expect(bySplit(dataset.rows, 'dev').length).toBeGreaterThan(0)
    expect(bySplit(dataset.rows, 'test').length).toBeGreaterThan(0)
    expect(new Set(dataset.rows.map((r) => r.gold))).toEqual(
      new Set(['verified', 'mismatch', 'suspect', 'out_of_index']),
    )
    expect(bySplit(dataset.rows, 'all')).toHaveLength(12)
  })

  it('has unique ids and a header with every documented column', () => {
    expect(new Set(dataset.rows.map((r) => r.id)).size).toBe(dataset.rows.length)
    const header = readFileSync(TEMPLATE_DATA, 'utf8')
      .split('\n')
      .find((l) => l.startsWith('id,'))
    expect(header?.split(',')).toEqual([...COLUMNS])
  })

  it('says in its own comments that it is not the evaluation data', () => {
    expect(readFileSync(TEMPLATE_DATA, 'utf8')).toMatch(/NOT the evaluation data/)
  })
})

describe('parseDataset validation', () => {
  const header = COLUMNS.join(',')
  const good = 'D1,dev,"A ref, with comma",verified,real,verified,verified,note'

  it('accepts a valid row, with labelers optional', () => {
    const rows = parseDataset(`${header}\n${good}\nD2,test,Another ref,suspect,perturbed,,,\n`)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ id: 'D1', text: 'A ref, with comma', labeler1: 'verified' })
    expect(rows[1]).toMatchObject({ labeler1: null, labeler2: null })
  })

  it('reports every problem at once, each with its row and id', () => {
    const bad = [
      header,
      good,
      'D1,dev,duplicate id,verified,real,,,',
      'D3,train,wrong split,verified,real,,,',
      'D4,dev,,verified,real,,,',
      'D5,dev,bad gold,maybe,real,,,',
      'D6,dev,bad source,verified,invented,,,',
      'D7,dev,bad labeler,verified,real,yes,,',
      ',dev,no id,verified,real,,,',
    ].join('\n')
    let message = ''
    try {
      parseDataset(bad)
    } catch (e) {
      message = (e as Error).message
    }
    expect(message).toMatch(/7 problem\(s\)/)
    for (const part of [
      'duplicate id "D1"',
      'D3): split must be dev or test',
      'D4): empty reference_text',
      'D5): gold_label must be one of',
      'D6): source_type must be one of',
      'D7): labeler1 must be a verdict or empty',
      'empty id',
    ]) {
      expect(message).toContain(part)
    }
  })

  it('names the missing columns', () => {
    expect(() => parseDataset('id,split\nD1,dev')).toThrow(/missing column "reference_text"/)
  })
})

describe('what a system is given', () => {
  it('toInputs carries an id and the reference text, and nothing that could reveal a label', () => {
    const rows = parseDataset(
      `${COLUMNS.join(',')}\nD1,dev,Some ref,verified,perturbed,verified,mismatch,secret note\n`,
    )
    const inputs = toInputs(rows)
    expect(inputs).toEqual([{ id: 'D1', text: 'Some ref' }])
    expect(Object.keys(inputs[0] as object).sort()).toEqual(['id', 'text'])
    expect(JSON.stringify(inputs)).not.toMatch(/verified|mismatch|secret|perturbed/)
  })
})
