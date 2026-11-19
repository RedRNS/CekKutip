import { en } from '../../apps/web/src/i18n/en'
import { id } from '../../apps/web/src/i18n/id'
import { MENU_ID, PENDING_KEY, handleMenuClick } from './menu'
import { openPanel } from './open-panel'
import type { PanelApi } from './open-panel'

/**
 * Service worker. It opens the side panel from the toolbar icon, and it owns the right-click item
 * that sends selected text to the panel.
 */

const menuTitle = () =>
  (chrome.i18n.getUILanguage().toLowerCase().startsWith('id') ? id : en).extension.menuTitle

/**
 * Make sure the menu item exists, exactly once. removeAll first, so running this again (an update,
 * a restart of the service worker) never fails on an item that is already there.
 */
function ensureMenu(): void {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: MENU_ID, title: menuTitle(), contexts: ['selection'] }, () => {
      void chrome.runtime.lastError // read it, so a rare duplicate does not print a warning
    })
  })
}

/** The toolbar icon opens the side panel. Without this the icon of a panel-only extension does nothing. */
function ensurePanelBehavior(): void {
  void chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
    /* a browser without the call falls back to action.onClicked below */
  })
}

const panelApi = (): PanelApi => ({
  openSidePanel: chrome.sidePanel?.open
    ? (windowId) => chrome.sidePanel.open({ windowId })
    : undefined,
  openTab: async () => {
    await chrome.tabs.create({ url: chrome.runtime.getURL('panel.html') })
  },
})

chrome.runtime.onInstalled.addListener(() => {
  ensureMenu()
  ensurePanelBehavior()
})
// Menu items outlive the service worker, but creating them is cheap and keeps them from ever being missing.
ensureMenu()
ensurePanelBehavior()

// Only fires when the icon is not set to open the panel by itself (a browser without the side panel).
chrome.action.onClicked.addListener((tab) => {
  void openPanel(tab.windowId, panelApi()).catch(() => undefined)
})

chrome.contextMenus.onClicked.addListener((info, tab) => {
  void handleMenuClick(info, {
    setPending: (text) => chrome.storage.session.set({ [PENDING_KEY]: text }),
    openPanel: () => openPanel(tab?.windowId, panelApi()),
    setBadge: (text) => chrome.action.setBadgeText({ text }),
  })
})
