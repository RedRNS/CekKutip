/* global document, localStorage */
// Runs before the page is drawn, so a person who chose a theme never sees the other one flash.
// With no saved choice the stylesheet follows the system. Keep the key the same as THEME_KEY in src/lib/theme.ts.
;(function () {
  try {
    var saved = localStorage.getItem('cekkutip.theme')
    if (saved === 'light' || saved === 'dark') {
      document.documentElement.setAttribute('data-theme', saved)
      var colour = saved === 'dark' ? '#0e191d' : '#12343b'
      var bars = document.querySelectorAll('meta[name="theme-color"]')
      for (var i = 0; i < bars.length; i++) bars[i].setAttribute('content', colour)
    }
  } catch {
    /* no storage: the system decides */
  }
})()
