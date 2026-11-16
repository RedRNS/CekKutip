import { describe, expect, it } from 'vitest'
import { Scheduler } from '../src/lib/scheduler.js'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((r) => (resolve = r))
  return { promise, resolve }
}

const tick = () => new Promise<void>((r) => setImmediate(r))

describe('Scheduler', () => {
  it('never exceeds the concurrency cap', async () => {
    const s = new Scheduler({ maxConcurrent: 2, minIntervalMs: 0 })
    let active = 0
    let peak = 0
    const gates = Array.from({ length: 5 }, deferred)
    const tasks = gates.map((g) =>
      s.run(async () => {
        active++
        peak = Math.max(peak, active)
        await g.promise
        active--
      }),
    )
    await tick()
    expect(active).toBe(2)
    for (const g of gates) {
      g.resolve()
      await tick()
    }
    await Promise.all(tasks)
    expect(peak).toBe(2)
  })

  it('spaces request starts by the minimum interval', async () => {
    // A frozen clock: each run must ask to wait until its own start slot.
    const waits: number[] = []
    const s = new Scheduler({
      maxConcurrent: 10,
      minIntervalMs: 100,
      now: () => 1000,
      sleep: async (ms) => void waits.push(ms),
    })
    await Promise.all([1, 2, 3, 4].map(() => s.run(async () => {})))
    expect(waits).toEqual([100, 200, 300]) // the first starts at once
  })

  it('releases the slot when the task throws', async () => {
    const s = new Scheduler({ maxConcurrent: 1, minIntervalMs: 0 })
    await expect(s.run(async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom')
    await expect(s.run(async () => 'ok')).resolves.toBe('ok')
  })

  it('applies new limits at runtime', async () => {
    const s = new Scheduler({ maxConcurrent: 1, minIntervalMs: 0 })
    const g = deferred()
    let started = 0
    const a = s.run(async () => {
      started++
      await g.promise
    })
    const b = s.run(async () => void started++)
    await tick()
    expect(started).toBe(1) // b is waiting
    s.configure({ maxConcurrent: 2 })
    await tick()
    expect(started).toBe(2) // raising the cap freed b
    g.resolve()
    await Promise.all([a, b])
    expect(s.limits).toEqual({ maxConcurrent: 2, minIntervalMs: 0 })
  })
})
