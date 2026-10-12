import { describe, expect, it, vi } from 'vitest'
import { keepScreenOn } from './wakeLock.ts'

function fakeEnv() {
  const listeners = new Set<() => void>()
  const sentinels: { released: boolean; onRelease?: () => void }[] = []
  const doc = {
    visibilityState: 'visible' as DocumentVisibilityState,
    addEventListener: (_: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
  }
  const wakeLock = {
    request: vi.fn(async () => {
      const s = {
        released: false,
        onRelease: undefined as (() => void) | undefined,
        release: async () => {
          s.released = true
          s.onRelease?.()
        },
        addEventListener: (_: string, cb: () => void) => {
          s.onRelease = cb
        },
      }
      sentinels.push(s)
      return s
    }),
  }
  const env = { navigator: { wakeLock }, document: doc } as unknown as Parameters<
    typeof keepScreenOn
  >[0]
  return { env, doc, wakeLock, sentinels, fire: () => listeners.forEach((cb) => cb()), listeners }
}

describe('keepScreenOn', () => {
  it('Wake Lock を取得し、release で解除する', async () => {
    const f = fakeEnv()
    const handle = keepScreenOn(f.env)
    await vi.waitFor(() => expect(f.sentinels).toHaveLength(1))
    handle.release()
    expect(f.sentinels[0]?.released).toBe(true)
    expect(f.listeners.size).toBe(0)
  })

  it('タブが裏に回って解除された後、表示に戻ったら取り直す', async () => {
    const f = fakeEnv()
    keepScreenOn(f.env)
    await vi.waitFor(() => expect(f.sentinels).toHaveLength(1))
    // ブラウザが自動で解除
    await (f.sentinels[0] as unknown as { release: () => Promise<void> }).release()
    f.doc.visibilityState = 'visible'
    f.fire()
    await vi.waitFor(() => expect(f.sentinels).toHaveLength(2))
  })

  it('Wake Lock がない環境では何もしない', () => {
    expect(() => keepScreenOn({}).release()).not.toThrow()
  })
})
