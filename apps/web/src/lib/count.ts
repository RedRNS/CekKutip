import { splitReferences } from '@cekkutip/shared/split'

/** The "N found" count. Uses the same splitter as the server, so the number matches what is checked. */
export function countReferences(text: string): number {
  return splitReferences(text).length
}
