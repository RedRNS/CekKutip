import { useCallback } from 'react'
import { LangSwitch } from '../../../apps/web/src/components/LangSwitch'
import { WorkbenchCore } from '../../../apps/web/src/components/Workbench'
import { useI18n } from '../../../apps/web/src/i18n'
import { useKeyStore } from '../../../apps/web/src/lib/apiKey'
import type { KeyStore } from '../../../apps/web/src/lib/apiKey'
import { SITE_URL } from '../site'

/** The extension popup: the same tool as the website, pointed at the CekKutip server. */
export function Popup({ store, initialText }: { store: KeyStore; initialText: string }) {
  const { t } = useI18n()
  const keyApi = useKeyStore(store)
  const getKey = useCallback(() => store.getState().key, [store])

  return (
    <div className="popup">
      <header className="popup__head">
        <p className="popup__title">CekKutip</p>
        <LangSwitch />
      </header>
      <WorkbenchCore
        keyApi={keyApi}
        getKey={getKey}
        baseUrl={SITE_URL}
        initialText={initialText}
        privacyHref={`${SITE_URL}/privacy`}
        keyLinkNote={t.extension.keyNote}
      />
      <footer className="popup__foot">
        <a href={SITE_URL} target="_blank" rel="noopener noreferrer">
          {t.extension.openSite}
          <span className="visually-hidden"> ({t.evidence.opensNewTab})</span>
        </a>
      </footer>
    </div>
  )
}
