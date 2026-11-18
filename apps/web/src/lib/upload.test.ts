import { describe, expect, it } from 'vitest'
import { MAX_UPLOAD_BYTES, appendText, readReferenceFile } from './upload'

const file = (name: string, content: string, size = content.length) => ({
  name,
  size,
  text: async () => content,
})

const BIB = `@article{k, author = {Doe, John}, title = {A study}, journal = {J}, year = 2020}
@misc{x, author = {Roe, J.}, year = 2019}`

describe('readReferenceFile', () => {
  it('reads a .txt file as it is, trimmed', async () => {
    const r = await readReferenceFile(
      file('refs.txt', '\n  Doe, J. (2020). A study.\n\nRoe, J. (2019). B.\n'),
    )
    expect(r).toEqual({
      ok: true,
      kind: 'txt',
      skipped: 0,
      text: 'Doe, J. (2020). A study.\n\nRoe, J. (2019). B.',
    })
  })

  it('turns a .bib file into one reference per paragraph and counts entries without a title', async () => {
    const r = await readReferenceFile(file('refs.bib', BIB))
    expect(r).toEqual({ ok: true, kind: 'bib', skipped: 1, text: 'Doe, J. (2020). A study. J.' })
  })

  it('is not case-sensitive about the extension', async () => {
    expect((await readReferenceFile(file('REFS.BIB', BIB))).ok).toBe(true)
    expect((await readReferenceFile(file('Refs.TXT', 'Doe, J. (2020). A.'))).ok).toBe(true)
  })

  it.each(['refs.pdf', 'refs.docx', 'refs', 'refs.bib.exe', 'refs.txt.js'])(
    'rejects %s as unsupported',
    async (name) => {
      expect(await readReferenceFile(file(name, 'x'))).toEqual({ ok: false, error: 'unsupported' })
    },
  )

  it('rejects a file over the size limit without reading it', async () => {
    let read = false
    const big = {
      name: 'big.txt',
      size: MAX_UPLOAD_BYTES + 1,
      text: async () => {
        read = true
        return 'x'
      },
    }
    expect(await readReferenceFile(big)).toEqual({ ok: false, error: 'too_large' })
    expect(read).toBe(false)
    expect((await readReferenceFile(file('edge.txt', 'x', MAX_UPLOAD_BYTES))).ok).toBe(true)
  })

  it('says "empty" for blank text, and for a .bib file with no usable entry', async () => {
    expect(await readReferenceFile(file('a.txt', '  \n \n'))).toEqual({ ok: false, error: 'empty' })
    expect(await readReferenceFile(file('a.bib', 'not bibtex at all'))).toEqual({
      ok: false,
      error: 'empty',
    })
    expect(await readReferenceFile(file('a.bib', '@misc{k, year = 2020}'))).toEqual({
      ok: false,
      error: 'empty',
    })
  })

  it('says "unreadable" when the file cannot be read, or holds binary data', async () => {
    const broken = {
      name: 'a.txt',
      size: 1,
      text: async () => {
        throw new Error('denied')
      },
    }
    expect(await readReferenceFile(broken)).toEqual({ ok: false, error: 'unreadable' })
    const nul = String.fromCharCode(0)
    expect(await readReferenceFile(file('a.txt', `ab${nul}cd`))).toEqual({
      ok: false,
      error: 'unreadable',
    })
  })
})

describe('appendText', () => {
  it('uses the new text alone when the box is empty or blank', () => {
    expect(appendText('', 'A')).toBe('A')
    expect(appendText('  \n', 'A')).toBe('A')
  })

  it('adds a blank line between what was there and what is new', () => {
    expect(appendText('One', 'Two')).toBe('One\n\nTwo')
    expect(appendText('One\n\n', 'Two')).toBe('One\n\nTwo')
  })
})
