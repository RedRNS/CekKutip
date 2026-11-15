/**
 * Text normalization shared by the matcher (server) and the field diff (client).
 * Deterministic and dependency-free.
 */

const LETTER_MAP: Record<string, string> = {
  ł: 'l',
  Ł: 'L',
  ø: 'o',
  Ø: 'O',
  đ: 'd',
  Đ: 'D',
  ß: 'ss',
  æ: 'ae',
  Æ: 'AE',
  œ: 'oe',
  Œ: 'OE',
  ı: 'i',
}

/** Remove combining marks (diacritics) and fold a few letters that do not decompose. */
export function stripDiacritics(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[łŁøØđĐßæÆœŒı]/gu, (c) => LETTER_MAP[c] ?? c)
}

/**
 * Lowercase, drop diacritics and punctuation, collapse whitespace.
 * Apostrophes are removed without leaving a gap (O'Brien becomes obrien);
 * every other punctuation mark becomes a space.
 */
export function normalizeText(input: string): string {
  return stripDiacritics(input.normalize('NFKC'))
    .toLowerCase()
    .replace(/['’‘`]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Split into normalized word tokens. */
export function tokenize(input: string): string[] {
  const n = normalizeText(input)
  return n === '' ? [] : n.split(' ')
}
