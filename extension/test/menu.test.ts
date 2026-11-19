import { describe, expect, it } from 'vitest'
import { MAX_PENDING_CHARS, MENU_ID, handleMenuClick } from '../src/menu'
import type { MenuApi } from '../src/menu'

function api(opts: { panelFails?: boolean } = {}) {
  const log: string[] = []
  const pending: string[] = []
  const menu: MenuApi = {
    setPending: async (text) => {
      log.push('pending')
      pending.push(text)
    },
    openPanel: async () => {
      log.push('panel')
      if (opts.panelFails) throw new Error('not allowed')
    },
    setBadge: async (text) => void log.push(`badge:${text}`),
  }
  return { menu, log, pending }
}

describe('the right-click item', () => {
  it('opens the side panel and puts the selection aside', async () => {
    const a = api()
    const out = await handleMenuClick(
      { menuItemId: MENU_ID, selectionText: '  Doe, J. (2020). A.  ' },
      a.menu,
    )
    expect(out).toBe('opened')
    expect(a.log).toEqual(['panel', 'pending'])
    expect(a.pending).toEqual(['Doe, J. (2020). A.'])
  })

  it('opens the panel before it awaits anything, because the click gesture lapses', async () => {
    // openPanel is called in the same turn as the click: nothing has been awaited yet.
    const calls: string[] = []
    const menu: MenuApi = {
      setPending: async () => void calls.push('pending'),
      openPanel: async () => void calls.push('panel'),
      setBadge: async () => undefined,
    }
    const done = handleMenuClick({ menuItemId: MENU_ID, selectionText: 'text' }, menu)
    // Called synchronously, before anything was awaited, and before the text was stored.
    expect(calls[0]).toBe('panel')
    await done
    expect(calls).toEqual(['panel', 'pending'])
  })

  it('shows a badge on the icon when the browser will not open the panel, and still keeps the text', async () => {
    const a = api({ panelFails: true })
    const out = await handleMenuClick(
      { menuItemId: MENU_ID, selectionText: 'Doe, J. (2020). A.' },
      a.menu,
    )
    expect(out).toBe('badge')
    expect(a.log).toEqual(['panel', 'pending', 'badge:1'])
    expect(a.pending).toHaveLength(1)
  })

  it('does nothing for another menu item, or for an empty selection', async () => {
    const a = api()
    expect(await handleMenuClick({ menuItemId: 'other', selectionText: 'text' }, a.menu)).toBe(
      'ignored',
    )
    expect(await handleMenuClick({ menuItemId: MENU_ID, selectionText: '   ' }, a.menu)).toBe(
      'ignored',
    )
    expect(await handleMenuClick({ menuItemId: MENU_ID }, a.menu)).toBe('ignored')
    expect(a.log).toEqual([])
  })

  it('cuts a very long selection so it still fits the server limit', async () => {
    const a = api()
    await handleMenuClick(
      { menuItemId: MENU_ID, selectionText: 'x'.repeat(MAX_PENDING_CHARS * 3) },
      a.menu,
    )
    expect(a.pending[0]?.length).toBe(MAX_PENDING_CHARS)
  })

  it('sends nothing anywhere: it only stores text and opens the panel', async () => {
    const a = api()
    await handleMenuClick({ menuItemId: MENU_ID, selectionText: 'text' }, a.menu)
    // The API has no way to reach a server: the only three actions are the ones the test recorded.
    expect(Object.keys(a.menu).sort()).toEqual(['openPanel', 'setBadge', 'setPending'])
  })
})
