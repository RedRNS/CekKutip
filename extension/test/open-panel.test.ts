import { describe, expect, it } from 'vitest'
import { openPanel } from '../src/open-panel'

function recorder(opts: { sidePanel?: boolean; sidePanelFails?: boolean } = {}) {
  const calls: string[] = []
  return {
    calls,
    api: {
      openSidePanel:
        opts.sidePanel === false
          ? undefined
          : async (windowId: number) => {
              calls.push(`side-panel:${windowId}`)
              if (opts.sidePanelFails) throw new Error('needs a user gesture')
            },
      openTab: async () => void calls.push('tab'),
    },
  }
}

describe('opening the extension panel', () => {
  it('opens the side panel of the window that was clicked', async () => {
    const r = recorder()
    await openPanel(7, r.api)
    expect(r.calls).toEqual(['side-panel:7'])
  })

  it('opens the same page as a tab when the browser has no side panel, so the icon never does nothing', async () => {
    const r = recorder({ sidePanel: false })
    await openPanel(7, r.api)
    expect(r.calls).toEqual(['tab'])
  })

  it('opens the tab when no window is named', async () => {
    const r = recorder()
    await openPanel(undefined, r.api)
    expect(r.calls).toEqual(['tab'])
  })

  it('passes on a refusal from the side panel, so the caller can tell the person', async () => {
    const r = recorder({ sidePanelFails: true })
    await expect(openPanel(7, r.api)).rejects.toThrow('user gesture')
    expect(r.calls).toEqual(['side-panel:7']) // it does not quietly open a tab instead
  })
})
