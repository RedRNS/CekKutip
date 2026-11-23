import { formatReferences } from '@cekkutip/shared/refformat'
import { describe, expect, it } from 'vitest'
import { itemHtml, itemText, listHtml, listText } from './formatExport'

const A = 'Zulkifli, A. (2020). Judul satu. Jurnal Satu, 1(1), 1-2.'
const B = 'Sugiyono. (2017). Metode penelitian. Bandung: Alfabeta.'

const items = (style: 'apa' | 'ieee' | 'harvard') =>
  formatReferences([A, B], { style, sentenceCase: false, sort: false })

describe('copying a reference', () => {
  it('writes plain text, with the IEEE number in front, and a blank line between references', () => {
    expect(itemText(items('apa')[0]!)).toBe('Zulkifli, A. (2020). Judul satu. Jurnal Satu, 1(1), 1–2.')
    expect(itemText(items('ieee')[0]!)).toBe(
      '[1] A. Zulkifli, "Judul satu," Jurnal Satu, vol. 1, no. 1, pp. 1–2, 2020.',
    )
    expect(listText(items('apa'))).toBe(
      'Zulkifli, A. (2020). Judul satu. Jurnal Satu, 1(1), 1–2.\n\nSugiyono. (2017). Metode penelitian. Bandung: Alfabeta.',
    )
  })

  it('writes HTML with the journal in italics and a hanging indent, for pasting into Word', () => {
    const html = itemHtml(items('apa')[0]!)
    expect(html).toContain('<i>Jurnal Satu</i>')
    expect(html).toContain('<i>1</i>(1)') // APA italicises the volume
    expect(html).toMatch(/^<p style="[^"]*text-indent:-36pt[^"]*">/)
    expect(listHtml(items('apa')).match(/<p /g)).toHaveLength(2)
  })

  it('puts the IEEE number inside the paragraph', () => {
    expect(itemHtml(items('ieee')[0]!)).toMatch(/>\[1\] A\. Zulkifli, /)
  })

  it('escapes what a reference contains, so pasted text cannot add markup', () => {
    const [item] = formatReferences(['Doe, J. (2020). <script>x</script> & more. Journal of X, 1(1), 1-2.'], {
      style: 'apa',
      sentenceCase: false,
      sort: false,
    })
    const html = itemHtml(item!)
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&amp; more')
  })
})
