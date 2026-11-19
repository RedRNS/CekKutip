import { describe, expect, it } from 'vitest'
import { MAX_PENDING_CHARS, MENU_ID, handleMenuClick } from '../src/menu'
import type { MenuApi } from '../src/menu'

function api(opts: { popupFails?: boolean } = {}) {
  const log: string[] = []
  const pending: string[] = []
  const menu: MenuApi = {
    setPending: async (text) => {
      log.push('pending')
      pending.push(text)
    },
    openPopup: async () => {
      log.push('popup')
      if (opts.popupFails) throw new Error('not allowed')
    },
    setBadge: async (text) => void log.push(`badge:${text}`),
  }
  return { menu, log, pending }
}

describe('the right-click item', () => {
  it('puts the selection aside, then opens the popup', async () => {
    const a = api()
    const out = await handleMenuClick(
      { menuItemId: MENU_ID, selectionText: '  Doe, J. (2020). A.  ' },
      a.menu,
    )
    expect(out).toBe('opened')
    expect(a.log).toEqual(['pending', 'popup'])
    expect(a.pending).toEqual(['Doe, J. (2020). A.'])
  })

  it('shows a badge on the icon when the browser will not open the popup, and still keeps the text', async () => {
    const a = api({ popupFails: true })
    const out = await handleMenuClick(
      { menuItemId: MENU_ID, selectionText: 'Doe, J. (2020). A.' },
      a.menu,
    )
    expect(out).toBe('badge')
    expect(a.log).toEqual(['pending', 'popup', 'badge:1'])
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

  it('sends nothing anywhere: it only stores text and opens the popup', async () => {
    const a = api()
    await handleMenuClick({ menuItemId: MENU_ID, selectionText: 'text' }, a.menu)
    // The API has no way to reach a server: the only three actions are the ones the test recorded.
    expect(Object.keys(a.menu).sort()).toEqual(['openPopup', 'setBadge', 'setPending'])
  })
})
