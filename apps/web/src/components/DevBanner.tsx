import { useI18n } from '../i18n'
import { findTodoFields } from '../site.config'

/** Development builds only: warn about site.config.ts placeholders. Production builds fail instead. */
export function DevBanner() {
  const { t } = useI18n()
  if (!import.meta.env.DEV) return null
  const todos = findTodoFields()
  if (todos.length === 0) return null
  return (
    <div className="dev-banner" role="note">
      <div className="container">
        {t.dev.todoBanner} <code>{todos.join(', ')}</code>
      </div>
    </div>
  )
}
