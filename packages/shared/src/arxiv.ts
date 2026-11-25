/**
 * arXiv identifiers. A new-style ID is YYMM.NNNN or YYMM.NNNNN (2007 on); an old-style one is
 * archive/YYMMNNN (hep-th/9901001, math.GT/0309136). The month must be 01 to 12.
 */
const NEW_ID = String.raw`\d{2}(?:0[1-9]|1[0-2])\.\d{4,5}`
const OLD_ID = String.raw`[a-z]+(?:-[a-z]+)*(?:\.[a-z]{2})?/\d{2}(?:0[1-9]|1[0-2])\d{3}`

/** The ID counts only when the text names it as an arXiv ID: "arXiv:" before it, or an arxiv.org address. */
const ARXIV_ID = new RegExp(
  String.raw`(?:\barxiv\s*:\s*|\barxiv\.org/(?:abs|pdf)/)(${NEW_ID}|${OLD_ID})(?!\d)`,
  'i',
)

/**
 * The arXiv ID written in a reference ("arXiv preprint arXiv:2407.12994v2" gives "2407.12994"), without
 * the version. Null when the text does not name one. A bare number is never taken for an ID, and a DOI
 * is left to the DOI path.
 */
export function extractArxivId(text: string): string | null {
  return ARXIV_ID.exec(text)?.[1] ?? null
}

/** arXiv registers a DOI with DataCite for every paper: 10.48550/arXiv.<id>. */
export const arxivDoi = (id: string): string => `10.48550/arXiv.${id}`
