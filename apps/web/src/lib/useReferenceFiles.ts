import { splitReferences } from '@cekkutip/shared/split'
import { useCallback, useState } from 'react'
import type { ChangeEvent } from 'react'
import { fmt, useI18n } from '../i18n'
import { MAX_FILES_PER_DROP, MAX_UPLOAD_BYTES, readReferenceFiles } from './upload'
import { useFileDrop } from './useFileDrop'

export interface UploadNote {
  /** What was added, one sentence per file. */
  added: string | null
  /** What could not be, one sentence per problem. */
  problems: string[]
}

export const MAX_UPLOAD_KB = MAX_UPLOAD_BYTES / 1024

/** A .bib file as it was, to be cleaned. */
export interface BibFile {
  name: string
  text: string
}

/**
 * Files chosen with the button or dropped anywhere on the page. They are read in the browser, and the text
 * of the ones that worked goes to `onText`. A .bib file is also handed to `onBib` as it was, for cleaning.
 * Nothing is sent anywhere. The same for the checker and for the page that rewrites references.
 */
export function useReferenceFiles(onText: (text: string) => void, onBib?: (file: BibFile) => void) {
  const { t } = useI18n()
  const [note, setNote] = useState<UploadNote | null>(null)
  const clearNote = useCallback(() => setNote(null), [])

  const addFiles = async (files: File[]) => {
    if (files.length === 0) return
    const read = await readReferenceFiles(files)
    // With one file the message is about that file. With several, each line names its file.
    const several = files.length > 1
    const added: string[] = []
    const problems: string[] = []
    for (const { name, result } of read.files) {
      if (result.ok) {
        const line = t.upload.added(splitReferences(result.text).length, name)
        added.push(result.skipped > 0 ? `${line} ${t.upload.skipped(result.skipped)}` : line)
      } else {
        const reason = fmt(t.upload.errors[result.error], { max: MAX_UPLOAD_KB })
        problems.push(several ? t.upload.failed(name, reason) : reason)
      }
    }
    if (read.ignored > 0) problems.push(t.upload.ignored(read.ignored, MAX_FILES_PER_DROP))
    if (read.text !== '') onText(read.text)
    for (const { name, result } of read.files) {
      if (result.ok && result.kind === 'bib' && result.raw !== undefined) onBib?.({ name, text: result.raw })
    }
    setNote({ added: added.length > 0 ? added.join(' ') : null, problems })
  }

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = '' // so the same file can be chosen again
    void addFiles(files)
  }

  const dropping = useFileDrop((files) => void addFiles(files))

  return { note, clearNote, onFile, dropping }
}
