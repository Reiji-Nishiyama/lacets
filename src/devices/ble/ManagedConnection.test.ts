import { afterEach, describe, expect, it, vi } from 'vitest'
import { FakeBleTransport } from '../../../test/helpers/FakeBleTransport.ts'
import { ManagedConnection } from './ManagedConnection.ts'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function setup(maxRetries = 3) {
  const t = new FakeBleTransport()
  const cleanup = vi.fn()
  const setupFn = vi.fn(async () => cleanup)
  const conn = new ManagedConnection({
    transport: t,
    request: { services: [0x1826] },
    setup: setupFn,
    retryDelaysMs: [100, 200],
    maxRetries,
  })
  return { t, conn, cleanup, setupFn }
}

describe('ManagedConnection', () => {
  it('初回接続が失敗したら disconnected に戻し、例外を投げる', async () => {
    const { t, conn } = setup()
    t.failNextConnects = 1
    await expect(conn.connect()).rejects.toThrow('接続失敗')
    expect(conn.state).toBe('disconnected')
    // デバイスは覚えているので、次の connect() で選択ダイアログは出ない
    await conn.connect()
    expect(conn.state).toBe('connected')
    expect(t.requestDeviceCount).toBe(1)
  })

  it('setup が失敗したら切断して例外を投げる', async () => {
    const t = new FakeBleTransport()
    const conn = new ManagedConnection({
      transport: t,
      request: { services: [0x1826] },
      setup: async () => {
        throw new Error('setup 失敗')
      },
    })
    await expect(conn.connect()).rejects.toThrow('setup 失敗')
    expect(conn.state).toBe('disconnected')
    expect(t.connected).toBe(false)
  })

  it('予期しない切断で後始末し、バックオフで再接続する', async () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { t, conn, cleanup, setupFn } = setup()
    await conn.connect()
    t.failNextConnects = 2
    t.drop()
    expect(cleanup).toHaveBeenCalledTimes(1)
    expect(conn.state).toBe('reconnecting')
    await vi.advanceTimersByTimeAsync(100) // 失敗
    await vi.advanceTimersByTimeAsync(200) // 失敗
    expect(conn.state).toBe('reconnecting')
    await vi.advanceTimersByTimeAsync(200) // 成功（末尾の遅延を繰り返す）
    expect(conn.state).toBe('connected')
    expect(setupFn).toHaveBeenCalledTimes(2)
  })

  it('再試行の上限に達したら disconnected になる', async () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { t, conn } = setup(2)
    await conn.connect()
    t.failNextConnects = 10
    t.drop()
    await vi.advanceTimersByTimeAsync(1000)
    expect(conn.state).toBe('disconnected')
    expect(t.connectCount).toBe(3)
  })

  it('再接続待ちの間に disconnect() したら再試行を止める', async () => {
    vi.useFakeTimers()
    const { t, conn } = setup()
    await conn.connect()
    t.drop()
    await conn.disconnect()
    await vi.advanceTimersByTimeAsync(1000)
    expect(conn.state).toBe('disconnected')
    expect(t.connectCount).toBe(1)
  })

  it('forget() 後は再びデバイスを選択する', async () => {
    const { t, conn } = setup()
    await conn.connect()
    await conn.forget()
    await conn.connect()
    expect(t.requestDeviceCount).toBe(2)
  })
})
