import { referencesFromBibtex } from '@cekkutip/shared/bibtex'
import { joinReferences } from '@cekkutip/shared/split'

/** Reference lists are short. A larger file is almost certainly not a reference list. */
export const MAX_UPLOAD_BYTES = 256 * 1024

export type UploadError = 'too_large' | 'unsupported' | 'empty' | 'unreadable'

export type UploadResult =
  | {
      ok: true
      /** Text for the input box: the file as it is (.txt), or one reference per paragraph (.bib). */
      text: string
      kind: 'txt' | 'bib'
      /** Entries in a .bib file that have no title and were left out. */
      skipped: number
    }
  | { ok: false; error: UploadError }

/**
 * Read a .txt or .bib file in the browser. Nothing is sent anywhere here: the text goes into the
 * input box, and only a later "Check references" sends it, like pasted text.
 */
export async function readReferenceFile(
  file: Pick<File, 'name' | 'size' | 'text'>,
): Promise<UploadResult> {
  const name = file.name.toLowerCase()
  const kind = name.endsWith('.bib') ? 'bib' : name.endsWith('.txt') ? 'txt' : null
  if (kind === null) return { ok: false, error: 'unsupported' }
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: 'too_large' }

  let raw: string
  try {
    raw = await file.text()
  } catch {
    return { ok: false, error: 'unreadable' }
  }
  // A binary file renamed to .txt decodes to text with NUL bytes.
  if (raw.includes(String.fromCharCode(0))) return { ok: false, error: 'unreadable' }

  if (kind === 'txt') {
    const text = raw.trim()
    return text === '' ? { ok: false, error: 'empty' } : { ok: true, text, kind, skipped: 0 }
  }

  const { references, skipped } = referencesFromBibtex(raw)
  return references.length === 0
    ? { ok: false, error: 'empty' }
    : { ok: true, text: joinReferences(references), kind, skipped }
}

/** Add text to what is already in the box, as a new paragraph. */
export function appendText(existing: string, added: string): string {
  return existing.trim() === '' ? added : `${existing.trimEnd()}\n\n${added}`
}
