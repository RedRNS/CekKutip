import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8')

/** The text between the braces of the first rule that starts with `selector`. */
function ruleBody(source: string, selector: string): string {
  const start = source.indexOf(selector)
  if (start < 0) throw new Error(`no rule for ${selector}`)
  const open = source.indexOf('{', start)
  let depth = 0
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++
    if (source[i] === '}' && --depth === 0) return source.slice(open + 1, i)
  }
  throw new Error(`unclosed rule for ${selector}`)
}

/** Colour tokens in a block: `--name: #rrggbb`. */
function colours(block: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of block.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})\b/g)) {
    out[m[1] as string] = (m[2] as string).toLowerCase()
  }
  return out
}

const lum = (hex: string): number => {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a: string, b: string): number => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

const light = colours(ruleBody(css, ':root {'))
// Dark: followed from the system unless the person chose light, or chosen with the switch.
const darkFromSystem = colours(
  ruleBody(ruleBody(css, '@media screen and (prefers-color-scheme: dark)'), ":root:not([data-theme='light'])"),
)
const darkChosen = colours(ruleBody(ruleBody(css, '@media screen {'), ":root[data-theme='dark']"))

const VERDICTS = ['verified', 'mismatch', 'suspect', 'oui'] as const

/** [foreground, background, least ratio]. Text is 4.5, lines and graphics are 3. */
function pairs(t: Record<string, string>): [string, string, number][] {
  const out: [string, string, number][] = [
    ['ink', 'paper', 4.5],
    ['ink', 'surface', 4.5],
    ['ink-muted', 'paper', 4.5],
    ['ink-muted', 'surface', 4.5],
    ['accent', 'paper', 4.5],
    ['accent', 'surface', 4.5],
    ['accent', 'accent-tint', 4.5],
    ['ink', 'accent-tint', 4.5],
    ['on-brand', 'brand', 4.5],
    ['on-brand', 'brand-hover', 4.5],
    ['brand', 'paper', 4.5],
    ['brand', 'surface', 4.5],
    ['rule-strong', 'paper', 3],
    ['rule-strong', 'surface', 3],
  ]
  for (const v of VERDICTS) {
    out.push([`${v}-ink`, 'surface', 4.5], [`${v}-ink`, `${v}-tint`, 4.5], [`${v}-solid`, 'surface', 3])
  }
  return out.filter(([a, b]) => t[a] !== undefined && t[b] !== undefined)
}

describe.each([
  ['light', light],
  ['dark', darkFromSystem],
] as const)('contrast in the %s theme', (_name, tokens) => {
  it.each(pairs(tokens))('%s on %s is at least %s:1', (fg, bg, least) => {
    expect(ratio(tokens[fg] as string, tokens[bg] as string)).toBeGreaterThanOrEqual(least)
  })

  it('checks every pair that the design needs, so a renamed token cannot skip a check', () => {
    expect(pairs(tokens)).toHaveLength(14 + VERDICTS.length * 3)
  })
})

describe('the dark theme', () => {
  it('has a value for every colour of the light theme, and no other', () => {
    expect(Object.keys(darkFromSystem).sort()).toEqual(Object.keys(light).sort())
  })

  it('is the same whether it follows the system or is chosen with the switch', () => {
    expect(darkChosen).toEqual(darkFromSystem)
  })

  it('is not the light theme with a few values changed: the background is dark and the text is light', () => {
    expect(lum(darkFromSystem.paper as string)).toBeLessThan(0.05)
    expect(lum(darkFromSystem.surface as string)).toBeLessThan(0.05)
    expect(lum(darkFromSystem.ink as string)).toBeGreaterThan(0.7)
  })

  it('keeps the panel lighter than the page, as the light theme keeps it', () => {
    expect(lum(darkFromSystem.surface as string)).toBeGreaterThan(lum(darkFromSystem.paper as string))
  })

  it('never applies to print: the explicit choice sits inside @media screen too', () => {
    const screen = ruleBody(css, '@media screen {')
    expect(screen).toContain(":root[data-theme='dark']")
    expect(css).not.toMatch(/^:root\[data-theme='dark'\]/m)
  })

  it('tells the browser which scheme it is, for form controls and scrollbars', () => {
    expect(css).toMatch(/color-scheme:\s*light dark/)
    expect(ruleBody(css, ":root[data-theme='dark']")).toMatch(/color-scheme:\s*dark/)
    expect(ruleBody(css, ":root[data-theme='light']")).toMatch(/color-scheme:\s*light/)
  })
})

describe('the light theme keeps its published values', () => {
  it('has the colours of docs/DESIGN.md', () => {
    expect(light).toMatchObject({
      paper: '#f6f8f7',
      surface: '#ffffff',
      ink: '#12232e',
      brand: '#12343b',
      accent: '#0b6b63',
      'verified-solid': '#2e7d32',
      'suspect-ink': '#a32a1e',
      'on-brand': '#ffffff',
    })
  })
})
