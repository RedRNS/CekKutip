import { en } from '../../apps/web/src/i18n/en'
import { id } from '../../apps/web/src/i18n/id'
import { MENU_ID, PENDING_KEY, handleMenuClick } from './menu'

/** Service worker. It does one thing: the right-click item that sends selected text to the popup. */

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

chrome.runtime.onInstalled.addListener(ensureMenu)
// Menu items outlive the service worker, but creating them is cheap and keeps them from ever being missing.
ensureMenu()

chrome.contextMenus.onClicked.addListener((info) => {
  void handleMenuClick(info, {
    setPending: (text) => chrome.storage.session.set({ [PENDING_KEY]: text }),
    openPopup: () => chrome.action.openPopup(),
    setBadge: (text) => chrome.action.setBadgeText({ text }),
  })
})
