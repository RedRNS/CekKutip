import { Moon, Sun } from 'lucide-react'
import { useI18n } from '../i18n'
import { useTheme } from '../lib/theme'

/** Light or dark. The system's setting is followed until this is used; then the choice is kept. */
export function ThemeToggle() {
  const { t } = useI18n()
  const { theme, toggle } = useTheme()
  // The name says what the button will do, so it changes with the theme. The icon is the same, drawn.
  const label = theme === 'dark' ? t.nav.theme.toLight : t.nav.theme.toDark
  return (
    <button type="button" className="theme-toggle" onClick={toggle} aria-label={label} title={label}>
      {theme === 'dark' ? (
        <Sun size={20} aria-hidden="true" />
      ) : (
        <Moon size={20} aria-hidden="true" />
      )}
    </button>
  )
}
