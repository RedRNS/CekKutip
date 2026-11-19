import { useCallback, useEffect, useState } from 'react'
import { LangSwitch } from '../../../apps/web/src/components/LangSwitch'
import { WorkbenchCore } from '../../../apps/web/src/components/Workbench'
import { useI18n } from '../../../apps/web/src/i18n'
import { useKeyStore } from '../../../apps/web/src/lib/apiKey'
import type { KeyStore } from '../../../apps/web/src/lib/apiKey'
import { SITE_URL } from '../site'
import { takePendingText, watchPendingText } from './chromeKey'

/**
 * The extension's side panel: the same tool as the website, pointed at the CekKutip server.
 * It stays open while the person clicks the page or changes tab, so a check keeps running.
 */
export function Panel({ store, initialText }: { store: KeyStore; initialText: string }) {
  const { t } = useI18n()
  const keyApi = useKeyStore(store)
  const getKey = useCallback(() => store.getState().key, [store])

  // A selection sent from the right-click menu while the panel is open replaces the text in the box.
  // The results on screen, and a check that is running, are left alone.
  const [incoming, setIncoming] = useState<{ text: string; n: number } | null>(null)
  useEffect(() => {
    let n = 0
    const deliver = (text: string) => setIncoming({ text, n: ++n })
    const stop = watchPendingText(deliver)
    // A selection stored after the first read but before the listener was added would be missed.
    void takePendingText().then((text) => {
      if (text) deliver(text)
    })
    return stop
  }, [])

  return (
    <div className="ext">
      <header className="ext__head">
        <p className="ext__title">CekKutip</p>
        <LangSwitch />
      </header>
      <WorkbenchCore
        keyApi={keyApi}
        getKey={getKey}
        baseUrl={SITE_URL}
        initialText={initialText}
        incomingText={incoming}
        privacyHref={`${SITE_URL}/privacy`}
        keyLinkNote={t.extension.keyNote}
      />
      <footer className="ext__foot">
        <a href={SITE_URL} target="_blank" rel="noopener noreferrer">
          {t.extension.openSite}
          <span className="visually-hidden"> ({t.evidence.opensNewTab})</span>
        </a>
      </footer>
    </div>
  )
}
