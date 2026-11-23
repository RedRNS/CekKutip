/**
 * Put text on the clipboard, with a rich (HTML) version beside it when the browser allows. Word and Google
 * Docs take the HTML and keep the italics; a plain text field takes the text. Returns false when nothing
 * could be copied.
 */
export async function copyRich(htmlText: string, plainText: string): Promise<boolean> {
  try {
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([htmlText], { type: 'text/html' }),
          'text/plain': new Blob([plainText], { type: 'text/plain' }),
        }),
      ])
      return true
    }
  } catch {
    /* the browser refused the rich copy: fall back to plain text */
  }
  return copyPlain(plainText)
}

export async function copyPlain(plainText: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(plainText)
    return true
  } catch {
    return false
  }
}
