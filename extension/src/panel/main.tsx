import '@fontsource/ibm-plex-sans/latin-400.css'
import '@fontsource/ibm-plex-sans/latin-500.css'
import '@fontsource/ibm-plex-sans/latin-600.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/newsreader/latin-600.css'
import '../../../apps/web/src/styles/tokens.css'
import '../../../apps/web/src/styles/base.css'
import '../../../apps/web/src/styles/components.css'
import '../../../apps/web/src/styles/workbench.css'
import './panel.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { I18nProvider } from '../../../apps/web/src/i18n'
import { Panel } from './Panel'
import { createExtensionKeyStore, takePendingText } from './chromeKey'

async function boot() {
  // Both reads finish before the first paint, so the key and any waiting text are there at once.
  const [store, pending] = await Promise.all([createExtensionKeyStore(), takePendingText()])
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <I18nProvider>
        <Panel store={store} initialText={pending} />
      </I18nProvider>
    </StrictMode>,
  )
}

void boot()
