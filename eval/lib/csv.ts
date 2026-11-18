/**
 * Small CSV reader and writer (RFC 4180 quoting). Lines that start with "#" and blank lines are skipped,
 * so a data file can carry instructions for the people who fill it in.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  let cellStarted = false
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text

  const endRow = () => {
    row.push(cell)
    const blank = row.length === 1 && row[0]?.trim() === ''
    const comment = (row[0] ?? '').trimStart().startsWith('#')
    if (!blank && !comment) rows.push(row)
    row = []
    cell = ''
    cellStarted = false
  }

  for (let i = 0; i < src.length; i++) {
    const c = src[i] as string
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"'
          i++
        } else quoted = false
      } else cell += c
      continue
    }
    if (c === '"' && !cellStarted) {
      quoted = true
      cellStarted = true
    } else if (c === ',') {
      row.push(cell)
      cell = ''
      cellStarted = false
    } else if (c === '\n') {
      endRow()
    } else if (c === '\r') {
      if (src[i + 1] === '\n') i++
      endRow()
    } else {
      cell += c
      cellStarted = true
    }
  }
  if (cell !== '' || row.length > 0) endRow()
  return rows
}

function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const s = String(value)
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map((r) => r.map(cell).join(',')).join('\n') + '\n'
}
