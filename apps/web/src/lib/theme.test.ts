import { describe, expect, it } from 'vitest'
import { THEME_COLOR, effectiveTheme, oppositeTheme, parsePreference } from './theme'

describe('parsePreference', () => {
  it('accepts only the two themes', () => {
    expect(parsePreference('light')).toBe('light')
    expect(parsePreference('dark')).toBe('dark')
  })

  it.each([null, undefined, '', 'system', 'auto', 'DARK', 'dark ', 0, {}, ['dark']])(
    'reads %j as no choice, so the system decides',
    (value) => {
      expect(parsePreference(value)).toBeNull()
    },
  )
})

describe('effectiveTheme', () => {
  it('follows the system until the person chooses', () => {
    expect(effectiveTheme(null, true)).toBe('dark')
    expect(effectiveTheme(null, false)).toBe('light')
  })

  it('goes with the person’s choice whatever the system says', () => {
    expect(effectiveTheme('light', true)).toBe('light')
    expect(effectiveTheme('dark', false)).toBe('dark')
  })
})

describe('oppositeTheme', () => {
  it('is the one the switch moves to', () => {
    expect(oppositeTheme('light')).toBe('dark')
    expect(oppositeTheme('dark')).toBe('light')
  })
})

describe('THEME_COLOR', () => {
  it('matches the page background of each theme, for the browser bar', () => {
    expect(THEME_COLOR.dark).toBe('#0e191d')
    expect(THEME_COLOR.light).toBe('#12343b')
  })
})
