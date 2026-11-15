export interface SchedulerOptions {
  /** Maximum requests in flight at once. */
  maxConcurrent: number
  /** Minimum gap between request starts, in ms. */
  minIntervalMs: number
  now?: () => number
  sleep?: (ms: number) => Promise<void>
}

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Per-service pacing: a concurrency cap plus a minimum start-to-start interval.
 * Limits can change at runtime (see `configure`) when a service tells us its real limits.
 */
export class Scheduler {
  private maxConcurrent: number
  private minIntervalMs: number
  private active = 0
  private nextStart = 0
  private waiters: (() => void)[] = []
  private readonly now: () => number
  private readonly sleep: (ms: number) => Promise<void>

  constructor(opts: SchedulerOptions) {
    this.maxConcurrent = Math.max(1, opts.maxConcurrent)
    this.minIntervalMs = Math.max(0, opts.minIntervalMs)
    this.now = opts.now ?? Date.now
    this.sleep = opts.sleep ?? realSleep
  }

  configure(limits: { maxConcurrent?: number; minIntervalMs?: number }): void {
    if (limits.maxConcurrent !== undefined) this.maxConcurrent = Math.max(1, limits.maxConcurrent)
    if (limits.minIntervalMs !== undefined) this.minIntervalMs = Math.max(0, limits.minIntervalMs)
    // A higher cap can free waiting callers right away.
    while (this.active < this.maxConcurrent && this.waiters.length > 0) {
      this.active++
      this.waiters.shift()?.()
    }
  }

  get limits(): { maxConcurrent: number; minIntervalMs: number } {
    return { maxConcurrent: this.maxConcurrent, minIntervalMs: this.minIntervalMs }
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire()
    try {
      const t = this.now()
      const start = Math.max(t, this.nextStart)
      this.nextStart = start + this.minIntervalMs
      if (start > t) await this.sleep(start - t)
      return await fn()
    } finally {
      this.release()
    }
  }

  private acquire(): Promise<void> {
    if (this.active < this.maxConcurrent) {
      this.active++
      return Promise.resolve()
    }
    return new Promise((resolve) => this.waiters.push(resolve))
  }

  private release(): void {
    const next = this.waiters.shift()
    if (next && this.active <= this.maxConcurrent)
      next() // hand the slot over
    else this.active--
  }
}
