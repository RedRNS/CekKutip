import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

/** Where the person's choice is kept. public/theme.js reads the same key before the page is drawn. */
export const THEME_KEY = 'cekkutip.theme'

/** The colour of the browser bar on a phone: the header of each theme. */
export const THEME_COLOR: Record<Theme, string> = { light: '#12343b', dark: '#0e191d' }

/** A saved value is the choice only if it is exactly one of the two themes. Anything else means "no choice". */
export function parsePreference(value: unknown): Theme | null {
  return value === 'light' || value === 'dark' ? value : null
}

/** The theme in use: the person's choice, or else the system's. */
export function effectiveTheme(preference: Theme | null, systemDark: boolean): Theme {
  return preference ?? (systemDark ? 'dark' : 'light')
}

export const oppositeTheme = (theme: Theme): Theme => (theme === 'dark' ? 'light' : 'dark')

/** A convenience only. With no storage, the choice lasts until the page is closed. */
function readPreference(): Theme | null {
  try {
    return parsePreference(localStorage.getItem(THEME_KEY))
  } catch {
    return null
  }
}

function savePreference(theme: Theme) {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    /* the browser keeps nothing */
  }
}

/** Put the choice on the page: the attribute the stylesheet reads, and the colour of the browser bar. */
function applyPreference(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    meta.setAttribute('content', THEME_COLOR[theme])
  }
}

const DARK_QUERY = '(prefers-color-scheme: dark)'

/**
 * The theme in use, and a switch to the other one. The system's setting is followed until the person
 * uses the switch, and from then on their choice is kept in this browser. Print is always light.
 */
export function useTheme(): { theme: Theme; toggle: () => void } {
  const [preference, setPreference] = useState<Theme | null>(readPreference)
  const [systemDark, setSystemDark] = useState(() => window.matchMedia(DARK_QUERY).matches)

  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY)
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  // Another tab of this site made a choice.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== THEME_KEY) return
      const next = parsePreference(e.newValue)
      setPreference(next)
      if (next !== null) applyPreference(next)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const theme = effectiveTheme(preference, systemDark)
  const toggle = useCallback(() => {
    const next = oppositeTheme(theme)
    savePreference(next)
    applyPreference(next)
    setPreference(next)
  }, [theme])

  return { theme, toggle }
}
