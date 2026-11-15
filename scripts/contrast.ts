/** WCAG contrast ratios for the design tokens. Run: npx tsx scripts/contrast.ts */

function lum(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)) as [
    number,
    number,
    number,
  ]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function ratio(a: string, b: string): number {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

const paper = '#F6F8F7'
const white = '#FFFFFF'
const pairs: [string, string, string, number][] = [
  ['ink on paper', '#12232E', paper, 4.5],
  ['ink-muted on paper', '#4B5B66', paper, 4.5],
  ['ink-muted on white', '#4B5B66', white, 4.5],
  ['accent (links, focus) on paper', '#0B6B63', paper, 4.5],
  ['accent on white', '#0B6B63', white, 4.5],
  ['accent on accent-tint', '#0B6B63', '#E3F0EE', 4.5],
  ['white on brand (primary button)', white, '#12343B', 4.5],
  ['white on brand-hover', white, '#0C262C', 4.5],
  ['brand on white (secondary button)', '#12343B', white, 4.5],
  ['rule-strong on white (input border)', '#6B7C78', white, 3],
  ['rule-strong on paper', '#6B7C78', paper, 3],
  ['verified ink on white', '#1E6B2A', white, 4.5],
  ['verified ink on tint', '#1E6B2A', '#E7F3E8', 4.5],
  ['mismatch ink on white', '#8A5300', white, 4.5],
  ['mismatch ink on tint', '#8A5300', '#FBF0DC', 4.5],
  ['suspect ink on white', '#A32A1E', white, 4.5],
  ['suspect ink on tint', '#A32A1E', '#F9E4E1', 4.5],
  ['out-of-index ink on white', '#465160', white, 4.5],
  ['out-of-index ink on tint', '#465160', '#E9ECEF', 4.5],
  ['verified solid on white (graphic)', '#2E7D32', white, 3],
  ['mismatch solid on white (graphic)', '#C27D0E', white, 3],
  ['suspect solid on white (graphic)', '#C0392B', white, 3],
  ['out-of-index solid on white (graphic)', '#5F6B7A', white, 3],
]

let failed = 0
for (const [label, fg, bg, min] of pairs) {
  const r = ratio(fg, bg)
  const ok = r >= min
  if (!ok) failed++
  console.log(`${ok ? 'pass' : 'FAIL'}  ${r.toFixed(2).padStart(5)}:1  (min ${min})  ${label}`)
}
if (process.argv[1]?.includes('contrast') && failed) process.exitCode = 1
