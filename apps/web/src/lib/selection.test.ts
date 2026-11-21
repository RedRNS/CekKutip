import { describe, expect, it } from 'vitest'
import { decideSelection, snippet } from './selection'

describe('what to do with text selected on a page', () => {
  it('fills an empty box', () => {
    expect(
      decideSelection({ box: '', lastFilled: null, incoming: 'Doe, J. (2020). A title.' }),
    ).toBe('fill')
    expect(decideSelection({ box: '  \n ', lastFilled: null, incoming: 'Doe, J. (2020).' })).toBe(
      'fill',
    )
  })

  it('replaces the previous selection, so the box follows what the person is reading', () => {
    expect(
      decideSelection({
        box: 'First selection here',
        lastFilled: 'First selection here',
        incoming: 'Second one',
      }),
    ).toBe('fill')
  })

  it('never overwrites text the person typed or pasted: it asks instead', () => {
    expect(
      decideSelection({
        box: 'My own list of references',
        lastFilled: null,
        incoming: 'Something selected',
      }),
    ).toBe('ask')
  })

  it('asks once the person has edited what a selection put there', () => {
    expect(
      decideSelection({
        box: 'First selection here plus my note',
        lastFilled: 'First selection here',
        incoming: 'Second one',
      }),
    ).toBe('ask')
  })

  it('does nothing when the selection is already what is in the box', () => {
    expect(
      decideSelection({ box: 'Same text here', lastFilled: null, incoming: 'Same text here' }),
    ).toBe('ignore')
  })
})

describe('the short form shown in the notice', () => {
  it('keeps a short text as it is, on one line', () => {
    expect(snippet('Doe, J.\n(2020).   A title.')).toBe('Doe, J. (2020). A title.')
  })

  it('cuts a long text and says so', () => {
    const out = snippet('word '.repeat(200), 40)
    expect(out.length).toBeLessThanOrEqual(41)
    expect(out.endsWith('…')).toBe(true)
  })
})
