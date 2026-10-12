import { afterEach, describe, expect, it, vi } from 'vitest'
import { FakeBleTransport } from '../../../test/helpers/FakeBleTransport.ts'
import { createFakeFtms } from '../../../test/helpers/fakeFtms.ts'
import { FTMS_CONTROL_POINT, FTMS_SERVICE, FTMS_STATUS, INDOOR_BIKE_DATA } from '../ble/uuids.ts'
import type { TrainerData } from '../TrainerDevice.ts'
import { DEFAULT_GRADE_RANGE, FtmsCommandError, FtmsTrainer } from './FtmsTrainer.ts'

const sim = (grade: number) => ({ windSpeedMps: 0, grade, crr: 0.004, cwKgPerM: 0.2 })
const cpWrites = (t: FakeBleTransport) => t.writesTo(FTMS_SERVICE, FTMS_CONTROL_POINT)

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('FtmsTrainer', () => {
  it('接続時に Request Control → Start を送り、能力を読む', async () => {
    const t = createFakeFtms()
    const trainer = new FtmsTrainer(t)
    await trainer.connect()
    expect(trainer.state).toBe('connected')
    expect(trainer.name).toBe('Fake Device')
    expect(cpWrites(t)).toEqual([[0x00], [0x07]])
    expect(trainer.capabilities).toEqual({
      gradeRange: { minGrade: -0.1, maxGrade: 0.2 },
      simulationSupported: true,
    })
  })

  it('Supported Inclination Range がなければ既定範囲を使う', async () => {
    const t = createFakeFtms({ withInclinationRange: false })
    const trainer = new FtmsTrainer(t)
    await trainer.connect()
    expect(trainer.capabilities?.gradeRange).toEqual(DEFAULT_GRADE_RANGE)
  })

  it('Indoor Bike Data をパワー・ケイデンスとして通知する（速度は診断用にだけ渡す）', async () => {
    const t = createFakeFtms()
    const trainer = new FtmsTrainer(t, { now: () => 1234 })
    const received: TrainerData[] = []
    trainer.onData((d) => received.push(d))
    await trainer.connect()
    t.notify(FTMS_SERVICE, INDOOR_BIKE_DATA, [0x44, 0x00, 0xb8, 0x0b, 0xb4, 0x00, 0xfa, 0x00])
    expect(received).toEqual([
      {
        powerW: 250,
        cadenceRpm: 90,
        heartRateBpm: undefined,
        trainerSpeedMps: expect.closeTo(30 / 3.6, 6),
        timestampMs: 1234,
      },
    ])
  })

  it('勾配を送る。範囲外の勾配はトレーナーの対応範囲にクランプする', async () => {
    const t = createFakeFtms()
    const trainer = new FtmsTrainer(t)
    await trainer.connect()
    await trainer.setSimulation(sim(0.08))
    await trainer.setSimulation(sim(0.3))
    await trainer.setSimulation(sim(-0.2))
    expect(cpWrites(t).slice(2)).toEqual([
      [0x11, 0x00, 0x00, 0x20, 0x03, 0x28, 0x14], // 8%
      [0x11, 0x00, 0x00, 0xd0, 0x07, 0x28, 0x14], // 20% にクランプ（2000 = 0x07D0）
      [0x11, 0x00, 0x00, 0x18, 0xfc, 0x28, 0x14], // -10% にクランプ（-1000 = 0xFC18）
    ])
  })

  it('送信待ちの間に来た勾配指令は最新の 1 件にまとめる', async () => {
    const t = createFakeFtms()
    const trainer = new FtmsTrainer(t)
    await trainer.connect()
    const p1 = trainer.setSimulation(sim(0.01))
    const p2 = trainer.setSimulation(sim(0.02))
    const p3 = trainer.setSimulation(sim(0.03))
    await Promise.all([p1, p2, p3])
    // 送信が始まる前に届いた指令は、最新の 0.03 の 1 件にまとまる
    const grades = cpWrites(t)
      .slice(2)
      .map((b) => new DataView(Uint8Array.from(b).buffer).getInt16(3, true))
    expect(grades).toEqual([300])
  })

  it('Control Not Permitted なら Request Control からやり直す', async () => {
    let rejectOnce = true
    const t = createFakeFtms({
      resultFor: (op) => {
        if (op === 0x11 && rejectOnce) {
          rejectOnce = false
          return 0x05
        }
        return 0x01
      },
    })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const trainer = new FtmsTrainer(t)
    await trainer.connect()
    await trainer.setSimulation(sim(0.05))
    expect(cpWrites(t).map((b) => b[0])).toEqual([0x00, 0x07, 0x11, 0x00, 0x11])
  })

  it('失敗の結果コードは FtmsCommandError になり、後続のコマンドは送れる', async () => {
    let fail = true
    const t = createFakeFtms({ resultFor: (op) => (op === 0x11 && fail ? 0x03 : 0x01) })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const trainer = new FtmsTrainer(t)
    await trainer.connect()
    await expect(trainer.setSimulation(sim(0.05))).rejects.toBeInstanceOf(FtmsCommandError)
    fail = false
    await expect(trainer.setSimulation(sim(0.05))).resolves.toBeUndefined()
  })

  it('応答がなければタイムアウトする', async () => {
    vi.useFakeTimers()
    const t = createFakeFtms({ resultFor: (op) => (op === 0x11 ? null : 0x01) })
    const trainer = new FtmsTrainer(t, { responseTimeoutMs: 500 })
    await trainer.connect()
    const p = trainer.setSimulation(sim(0.05))
    const assertion = expect(p).rejects.toThrow('応答がありません')
    await vi.advanceTimersByTimeAsync(500)
    await assertion
  })

  it('制御権を失ったら取り直して勾配を再送する', async () => {
    const t = createFakeFtms()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const trainer = new FtmsTrainer(t)
    await trainer.connect()
    await trainer.setSimulation(sim(0.05))
    t.writes.length = 0
    t.notify(FTMS_SERVICE, FTMS_STATUS, [0xff])
    await vi.waitFor(() => expect(cpWrites(t)).toHaveLength(3))
    expect(cpWrites(t).map((b) => b[0])).toEqual([0x00, 0x07, 0x11])
  })

  it('予期しない切断後に自動再接続し、直前の勾配を送り直す', async () => {
    vi.useFakeTimers()
    const t = createFakeFtms()
    const trainer = new FtmsTrainer(t)
    const states: string[] = []
    trainer.onStateChange((s) => states.push(s))
    await trainer.connect()
    await trainer.setSimulation(sim(0.06))
    t.writes.length = 0

    t.failNextConnects = 1
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    t.drop()
    expect(trainer.state).toBe('reconnecting')
    await vi.advanceTimersByTimeAsync(1000) // 1 回目: 失敗
    expect(trainer.state).toBe('reconnecting')
    await vi.advanceTimersByTimeAsync(2000) // 2 回目: 成功
    expect(trainer.state).toBe('connected')
    expect(states).toEqual(['connecting', 'connected', 'reconnecting', 'connected'])
    expect(cpWrites(t).map((b) => b[0])).toEqual([0x00, 0x07, 0x11])
    expect(t.requestDeviceCount).toBe(1) // 再接続ではデバイス選択をやり直さない
  })

  it('切断時に Stop を送り、再接続しない', async () => {
    vi.useFakeTimers()
    const t = createFakeFtms()
    const trainer = new FtmsTrainer(t)
    await trainer.connect()
    await trainer.disconnect()
    expect(cpWrites(t).at(-1)).toEqual([0x08, 0x01])
    expect(trainer.state).toBe('disconnected')
    await vi.advanceTimersByTimeAsync(60_000)
    expect(trainer.state).toBe('disconnected')
    expect(t.connectCount).toBe(1)
  })

  it('未接続時の勾配は保持して接続時に送る', async () => {
    const t = createFakeFtms()
    const trainer = new FtmsTrainer(t)
    await trainer.setSimulation(sim(0.04))
    expect(t.writes).toHaveLength(0)
    await trainer.connect()
    expect(cpWrites(t).map((b) => b[0])).toEqual([0x00, 0x07, 0x11])
  })
})
