import { describe, expect, it } from 'vitest'
import { countReferences } from './count'

describe('countReferences', () => {
  it('counts what the server will check', () => {
    const text = '1. Alpha, A. (2020). One.\n2. Beta, B. (2021). Two.\n3. Gamma, C. (2022). Three.'
    expect(countReferences(text)).toBe(3)
  })

  it('is zero for blank text', () => {
    expect(countReferences('  \n\n ')).toBe(0)
  })
})
