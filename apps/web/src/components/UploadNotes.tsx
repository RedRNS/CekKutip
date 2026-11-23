import type { UploadNote } from '../lib/useReferenceFiles'

/** What the last chosen or dropped files did: what was added, and what could not be. */
export function UploadNotes({ note }: { note: UploadNote | null }) {
  if (note === null) return null
  return (
    <>
      {note.added && (
        <p className="hint" role="status">
          {note.added}
        </p>
      )}
      {note.problems.length > 0 && (
        <div className="field-error" role="alert">
          {note.problems.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      )}
    </>
  )
}
