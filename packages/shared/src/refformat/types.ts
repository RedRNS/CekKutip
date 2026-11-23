/** A person or an organisation named as an author. `given` is initials or full given names, as written. */
export interface Person {
  family: string
  given: string
  /** An organisation (World Health Organization, BPS): one name, never split, no initials. */
  org: boolean
}

/** A journal article, read from a reference written in any of the supported shapes. */
export interface JournalArticle {
  authors: Person[]
  /** The text said "et al." or "dkk." The other authors are not known. */
  etAl: boolean
  /** The order of at least one name had to be guessed. */
  namesUncertain: boolean
  /** "2023", "2023a", or "n.d." */
  year: string
  title: string
  journal: string
  volume: string | null
  issue: string | null
  /** A range with a hyphen ("207-217"), or one page, or an article number. */
  pages: string | null
  /** The text itself called `pages` an article number ("Art. no.", "article"). */
  articleNumber: boolean
  /** Without "https://doi.org/". */
  doi: string | null
  /** An address that is not a DOI. */
  url: string | null
}

export type FormatStyle = 'apa' | 'ieee' | 'harvard'
export const FORMAT_STYLES: readonly FormatStyle[] = ['apa', 'ieee', 'harvard']

/** A piece of a written reference. Italic pieces are the journal name and, in APA, the volume. */
export interface Piece {
  text: string
  italic?: boolean
}

/** What a note says. The words come from templates in the copy deck, never from here. */
export type NoteCode =
  | 'names_uncertain'
  | 'et_al_kept'
  | 'authors_shortened'
  | 'article_number_assumed'
  | 'title_case'
  | 'sentence_case_applied'
  | 'ieee_journal_abbreviation'

/** The parts a reference is made of, for saying which of them changed. */
export const FIELDS = ['authors', 'year', 'title', 'source', 'doi'] as const
export type FieldName = (typeof FIELDS)[number]
export type Parts = Record<FieldName, string>

export interface FormatOptions {
  /** Put the title into sentence case. Off unless the person asks: names and acronyms cannot be known. */
  sentenceCase: boolean
}

export interface Formatted {
  pieces: Piece[]
  /** The same reference, part by part, as plain text. */
  parts: Parts
  notes: NoteCode[]
}
