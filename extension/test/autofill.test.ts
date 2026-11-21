import { describe, expect, it } from 'vitest'
import {
  MAX_SELECTION_CHARS,
  PAGE_ORIGINS,
  ensureAutoFill,
  selectionToSend,
  turnOff,
  turnOn,
} from '../src/autofill'
import type { AutoFillApi } from '../src/autofill'

function fake(opts: { grant?: boolean; flag?: boolean; has?: boolean; registered?: boolean } = {}) {
  const log: string[] = []
  const state = {
    flag: opts.flag ?? false,
    has: opts.has ?? false,
    registered: opts.registered ?? false,
  }
  const api: AutoFillApi = {
    requestOrigins: async (origins) => {
      log.push(`request:${origins.join(',')}`)
      if (opts.grant === false) return false
      state.has = true
      return true
    },
    hasOrigins: async () => state.has,
    removeOrigins: async () => {
      log.push('remove')
      state.has = false
    },
    getFlag: async () => state.flag,
    setFlag: async (on) => {
      log.push(`flag:${on}`)
      state.flag = on
    },
    isRegistered: async () => state.registered,
    register: async () => {
      log.push('register')
      state.registered = true
    },
    unregister: async () => {
      log.push('unregister')
      state.registered = false
    },
    injectIntoOpenTabs: async () => void log.push('inject'),
  }
  return { api, log, state }
}

describe('turning "fill the box from a selection" on', () => {
  it('asks the browser first, in the same turn as the click, and only for ordinary web pages', async () => {
    const f = fake()
    const done = turnOn(f.api)
    expect(f.log).toEqual([`request:${PAGE_ORIGINS.join(',')}`]) // before anything was awaited
    expect(await done).toBe('on')
    expect(f.log).toEqual([`request:${PAGE_ORIGINS.join(',')}`, 'register', 'flag:true', 'inject'])
    expect(PAGE_ORIGINS).toEqual(['http://*/*', 'https://*/*']) // not file:, chrome:, or the browser's own pages
  })

  it('changes nothing when the person says no', async () => {
    const f = fake({ grant: false })
    expect(await turnOn(f.api)).toBe('denied')
    expect(f.log).toHaveLength(1)
    expect(f.state).toEqual({ flag: false, has: false, registered: false })
  })
})

describe('turning it off', () => {
  it('stops pages that already have the script first, then removes the script and gives the permission back', async () => {
    const f = fake({ flag: true, has: true, registered: true })
    await turnOff(f.api)
    expect(f.log).toEqual(['flag:false', 'unregister', 'remove'])
    expect(f.state).toEqual({ flag: false, has: false, registered: false })
  })
})

describe('keeping the choice and the permission in agreement', () => {
  it('leaves everything as it is when it is on and in order', async () => {
    const f = fake({ flag: true, has: true, registered: true })
    expect(await ensureAutoFill(f.api)).toBe('on')
    expect(f.log).toEqual([])
  })

  it('registers the script again when it went missing (an update, a new profile)', async () => {
    const f = fake({ flag: true, has: true, registered: false })
    expect(await ensureAutoFill(f.api)).toBe('on')
    expect(f.log).toEqual(['register'])
  })

  it('switches the choice off when the person took the permission away in the browser', async () => {
    const f = fake({ flag: true, has: false, registered: true })
    expect(await ensureAutoFill(f.api)).toBe('off')
    expect(f.state).toEqual({ flag: false, has: false, registered: false })
  })

  it('removes a script that is left over from an earlier choice', async () => {
    const f = fake({ flag: false, has: false, registered: true })
    expect(await ensureAutoFill(f.api)).toBe('off')
    expect(f.log).toEqual(['unregister'])
  })

  it('does nothing, and asks for nothing, when it was never turned on', async () => {
    const f = fake()
    expect(await ensureAutoFill(f.api)).toBe('off')
    expect(f.log).toEqual([])
  })
})

describe('which selections are worth sending', () => {
  it('sends a sentence or a reference, trimmed', () => {
    expect(selectionToSend('  Doe, J. (2020). A title.  ', null)).toBe('Doe, J. (2020). A title.')
  })

  it('keeps line breaks inside a selection', () => {
    expect(selectionToSend('Doe, J. (2020).\nA title here.', null)).toBe(
      'Doe, J. (2020).\nA title here.',
    )
  })

  it('ignores nothing-selected, a word or two (a double click), and the same text again', () => {
    expect(selectionToSend('', null)).toBeNull()
    expect(selectionToSend('   \n ', null)).toBeNull()
    expect(selectionToSend('bibliographic', null)).toBeNull()
    expect(selectionToSend('two words', null)).toBeNull()
    expect(selectionToSend('Doe, J. (2020). A title.', 'Doe, J. (2020). A title.')).toBeNull()
  })

  it('sends a DOI on its own: it is one word, and it is a reference', () => {
    expect(selectionToSend('10.1038/s41598-023-41032-5', null)).toBe('10.1038/s41598-023-41032-5')
    expect(selectionToSend('https://doi.org/10.1038/s41598-023-41032-5', null)).not.toBeNull()
  })

  it('cuts a very long selection (select all) so it still fits the server limit', () => {
    const out = selectionToSend('word '.repeat(MAX_SELECTION_CHARS), null)
    expect(out).not.toBeNull()
    expect(out!.length).toBeLessThanOrEqual(MAX_SELECTION_CHARS)
  })
})
