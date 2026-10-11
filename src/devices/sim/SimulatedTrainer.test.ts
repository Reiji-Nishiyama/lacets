import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TrainerData } from '../TrainerDevice.ts'
import { SimulatedTrainer } from './SimulatedTrainer.ts'

afterEach(() => {
  vi.useRealTimers()
})

const sim = (grade: number) => ({ windSpeedMps: 0, grade, crr: 0.004, cwKgPerM: 0.2 })

function setup() {
  vi.useFakeTimers()
  const trainer = new SimulatedTrainer({ now: () => 0, random: () => 0.5 })
  const received: TrainerData[] = []
  trainer.onData((d) => received.push(d))
  return { trainer, received }
}

describe('SimulatedTrainer', () => {
  it('接続すると 4 Hz でデータを通知する', async () => {
    const { trainer, received } = setup()
    await trainer.connect()
    expect(trainer.state).toBe('connected')
    vi.advanceTimersByTime(1000)
    expect(received).toHaveLength(4)
    expect(received[0]).toEqual({ powerW: 200, cadenceRpm: 90, timestampMs: 0 })
  })

  it('grade モードでは勾配に応じてパワーが変わる', async () => {
    const { trainer, received } = setup()
    await trainer.connect()
    await trainer.setSimulation(sim(0.08))
    vi.advanceTimersByTime(250)
    expect(received.at(-1)?.powerW).toBe(264)
  })

  it('勾配はシミュレータの対応範囲にクランプする', async () => {
    const { trainer } = setup()
    await trainer.connect()
    await trainer.setSimulation(sim(0.5))
    expect(trainer.currentGrade).toBe(0.2)
  })

  it('fixed モードでは設定値のまま', async () => {
    const { trainer, received } = setup()
    trainer.setSettings({ mode: 'fixed', basePowerW: 150, baseCadenceRpm: 85 })
    await trainer.connect()
    await trainer.setSimulation(sim(0.1))
    vi.advanceTimersByTime(250)
    expect(received.at(-1)).toMatchObject({ powerW: 150, cadenceRpm: 85 })
  })

  it('切断の模擬中はデータが止まり、時間が経つと復帰する', async () => {
    const { trainer, received } = setup()
    const states: string[] = []
    trainer.onStateChange((s) => states.push(s))
    await trainer.connect()
    trainer.simulateDropout(2000)
    vi.advanceTimersByTime(1999)
    expect(received).toHaveLength(0)
    expect(trainer.state).toBe('reconnecting')
    vi.advanceTimersByTime(1)
    expect(trainer.state).toBe('connected')
    vi.advanceTimersByTime(250)
    expect(received).toHaveLength(1)
    expect(states).toEqual(['connecting', 'connected', 'reconnecting', 'connected'])
  })

  it('切断するとデータが止まる', async () => {
    const { trainer, received } = setup()
    await trainer.connect()
    await trainer.disconnect()
    vi.advanceTimersByTime(1000)
    expect(received).toHaveLength(0)
    expect(trainer.capabilities).toBeNull()
  })
})
