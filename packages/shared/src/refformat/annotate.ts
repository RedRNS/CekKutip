import { markChanges } from './diff.js'
import { plain } from './pieces.js'
import type { Piece } from './types.js'

export interface Run {
  text: string
  italic: boolean
  /** Not in the text it was compared with. */
  changed: boolean
}

/**
 * The written reference as runs of text that are italic or not and changed or not, ready to show: what is
 * new compared with `before` is marked, and the italics of the pieces are kept.
 */
export function annotate(pieces: readonly Piece[], before: string): Run[] {
  const marks = markChanges(before, plain(pieces))
  const runs: Run[] = []
  let pieceIndex = 0
  let offset = 0

  for (const mark of marks) {
    let rest = mark.text
    while (rest.length > 0) {
      while (pieces[pieceIndex] !== undefined && offset >= (pieces[pieceIndex] as Piece).text.length) {
        pieceIndex++
        offset = 0
      }
      const piece = pieces[pieceIndex]
      if (piece === undefined) break
      const take = Math.min(rest.length, piece.text.length - offset)
      const run: Run = {
        text: rest.slice(0, take),
        italic: piece.italic === true,
        changed: mark.changed,
      }
      const last = runs[runs.length - 1]
      if (last !== undefined && last.italic === run.italic && last.changed === run.changed) {
        last.text += run.text
      } else {
        runs.push(run)
      }
      rest = rest.slice(take)
      offset += take
    }
  }
  return runs
}
