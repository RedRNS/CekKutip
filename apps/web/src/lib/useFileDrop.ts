import { useEffect, useRef, useState } from 'react'
import { dragHasFiles } from './upload'

/**
 * Lets a person drop files anywhere on the page. Returns true while files are being dragged over it,
 * so the tool can show where they will go.
 *
 * The listeners sit on the window on purpose: a file dropped anywhere the page does not handle makes
 * the browser open it and leave the tool, with the person's list lost. Only drags that carry files are
 * touched. Dragged text is left to the browser.
 *
 * Nothing is read or sent here. `onFiles` gets the File objects, and the caller reads them in the browser.
 */
export function useFileDrop(onFiles: (files: File[]) => void): boolean {
  const [dragging, setDragging] = useState(false)
  const latest = useRef(onFiles)
  useEffect(() => {
    latest.current = onFiles
  })

  useEffect(() => {
    // dragenter and dragleave fire for every element the pointer crosses, so count them in and out.
    let depth = 0
    const carriesFiles = (e: DragEvent) => dragHasFiles(e.dataTransfer?.types)

    const enter = (e: DragEvent) => {
      if (!carriesFiles(e)) return
      e.preventDefault()
      depth += 1
      setDragging(true)
    }
    const over = (e: DragEvent) => {
      if (!carriesFiles(e)) return
      e.preventDefault() // without this the browser refuses the drop
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }
    const leave = (e: DragEvent) => {
      if (!carriesFiles(e)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragging(false)
    }
    const drop = (e: DragEvent) => {
      if (!carriesFiles(e)) return
      e.preventDefault()
      depth = 0
      setDragging(false)
      const files = Array.from(e.dataTransfer?.files ?? [])
      if (files.length > 0) latest.current(files)
    }

    window.addEventListener('dragenter', enter)
    window.addEventListener('dragover', over)
    window.addEventListener('dragleave', leave)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragover', over)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('drop', drop)
    }
  }, [])

  return dragging
}
