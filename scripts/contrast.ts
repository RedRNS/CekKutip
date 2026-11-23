/**
 * WCAG contrast ratios for the design tokens, in both themes. Run: npx tsx scripts/contrast.ts
 * The colours are read from apps/web/src/styles/tokens.css, so this cannot drift from the stylesheet.
 * The same pairs are checked on every test run by apps/web/src/styles/tokens.test.ts.
 */
import { readFileSync } from 'node:fs'

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

const css = readFileSync(new URL('../apps/web/src/styles/tokens.css', import.meta.url), 'utf8')

/** The text between the braces of the first rule that starts with `selector`. */
function ruleBody(source: string, selector: string): string {
  const start = source.indexOf(selector)
  const open = source.indexOf('{', start)
  let depth = 0
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++
    if (source[i] === '}' && --depth === 0) return source.slice(open + 1, i)
  }
  throw new Error(`no rule for ${selector}`)
}

function colours(block: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of block.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})\b/g)) {
    out[m[1] as string] = (m[2] as string).toUpperCase()
  }
  return out
}

const themes: [string, Record<string, string>][] = [
  ['light', colours(ruleBody(css, ':root {'))],
  [
    'dark',
    colours(
      ruleBody(
        ruleBody(css, '@media screen and (prefers-color-scheme: dark)'),
        ":root:not([data-theme='light'])",
      ),
    ),
  ],
]

const VERDICTS = ['verified', 'mismatch', 'suspect', 'oui'] as const

/** [foreground token, background token, least ratio, label]. Text is 4.5, lines and graphics are 3. */
const pairs: [string, string, number, string][] = [
  ['ink', 'paper', 4.5, 'ink on paper'],
  ['ink', 'surface', 4.5, 'ink on surface'],
  ['ink-muted', 'paper', 4.5, 'ink-muted on paper'],
  ['ink-muted', 'surface', 4.5, 'ink-muted on surface'],
  ['accent', 'paper', 4.5, 'accent (links, focus) on paper'],
  ['accent', 'surface', 4.5, 'accent on surface'],
  ['accent', 'accent-tint', 4.5, 'accent on accent-tint'],
  ['ink', 'accent-tint', 4.5, 'ink on accent-tint'],
  ['on-brand', 'brand', 4.5, 'on-brand on brand (primary button)'],
  ['on-brand', 'brand-hover', 4.5, 'on-brand on brand-hover'],
  ['brand', 'paper', 4.5, 'brand on paper (wordmark)'],
  ['brand', 'surface', 4.5, 'brand on surface (secondary button)'],
  ['rule-strong', 'paper', 3, 'rule-strong on paper (input border)'],
  ['rule-strong', 'surface', 3, 'rule-strong on surface'],
  ...VERDICTS.flatMap((v): [string, string, number, string][] => [
    [`${v}-ink`, 'surface', 4.5, `${v} ink on surface`],
    [`${v}-ink`, `${v}-tint`, 4.5, `${v} ink on tint`],
    [`${v}-solid`, 'surface', 3, `${v} solid on surface (graphic)`],
  ]),
]

let failed = 0
for (const [theme, tokens] of themes) {
  console.log(`\n${theme}`)
  for (const [fg, bg, min, label] of pairs) {
    const a = tokens[fg]
    const b = tokens[bg]
    if (a === undefined || b === undefined) {
      failed++
      console.log(`FAIL  missing token for ${label}`)
      continue
    }
    const r = ratio(a, b)
    const ok = r >= min
    if (!ok) failed++
    console.log(`${ok ? 'pass' : 'FAIL'}  ${r.toFixed(2).padStart(5)}:1  (min ${min})  ${label}`)
  }
}
if (process.argv[1]?.includes('contrast') && failed) process.exitCode = 1
