/** The name for a cleaned copy of a .bib file: "references.bib" becomes "references.clean.bib". */
export function cleanedFileName(name: string): string {
  const base = name.replace(/\.bib$/i, '')
  return /\.clean$/i.test(base) ? `${base}.bib` : `${base}.clean.bib`
}

/**
 * Give the person a file to save. The text is made in this browser and goes into a Blob, so it is never
 * sent anywhere. Returns false when the browser cannot do it.
 */
export function downloadText(fileName: string, text: string, type = 'text/plain'): boolean {
  try {
    const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }))
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.hidden = true
    document.body.append(link)
    link.click()
    link.remove()
    // The browser needs a moment to start the download before the address is let go.
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    return true
  } catch {
    return false
  }
}
