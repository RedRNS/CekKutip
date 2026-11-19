import { useEffect } from 'react'
import { useI18n } from './i18n'

type TitleKey = 'home' | 'how' | 'evaluation' | 'about' | 'extension' | 'privacy' | 'notFound'

/** Keeps the document title and meta description in step with the page and language. */
export function usePageTitle(key: TitleKey) {
  const { t, lang } = useI18n()
  const title = t.meta.titles[key]
  const description = t.meta.description

  useEffect(() => {
    document.title = `${title} · ${t.meta.siteName}`
    const meta = document.querySelector('meta[name="description"]')
    if (meta) meta.setAttribute('content', description)
  }, [title, description, lang, t.meta.siteName])
}
