/**
 * Temporary count for the "N found" label: paragraphs separated by blank lines.
 * TODO(M2): replace with the shared deterministic splitter so the client count always
 * equals what the server will check.
 */
export function roughCount(text: string): number {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p !== '').length
}
