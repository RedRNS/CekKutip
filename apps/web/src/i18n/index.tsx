import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { en } from './en'
import type { Dict } from './en'
import { id } from './id'

export type Lang = 'en' | 'id'

const dictionaries: Record<Lang, Dict> = { en, id }
const STORAGE_KEY = 'cekkutip.lang'

function readStoredLang(): Lang | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    return v === 'en' || v === 'id' ? v : null
  } catch {
    return null
  }
}

function detectLang(): Lang {
  const stored = readStoredLang()
  if (stored) return stored
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'en'
  return nav.toLowerCase().startsWith('id') ? 'id' : 'en'
}

/** Replace {name} placeholders in a template. */
export function fmt(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`))
}

interface I18nValue {
  lang: Lang
  t: Dict
  setLang: (lang: Lang) => void
}

const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang)

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* storage can be blocked; the choice then lasts for this visit only */
    }
  }, [])

  const value = useMemo(() => ({ lang, t: dictionaries[lang], setLang }), [lang, setLang])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider')
  return ctx
}
