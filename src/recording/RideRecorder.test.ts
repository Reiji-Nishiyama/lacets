import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Course } from '../domain/course/Course.ts'
import { DEFAULT_RIDER_SETTINGS } from '../domain/rider.ts'
import { SimulatedTrainer } from '../devices/sim/SimulatedTrainer.ts'
import { RideEngine } from '../ride/RideEngine.ts'
import { RideRecorder } from './RideRecorder.ts'

const course = new Course([
  { distanceM: 0, lat: 45, lon: 6, elevationM: 0, grade: 0.05 },
  { distanceM: 5000, lat: 45.045, lon: 6, elevationM: 250, grade: 0.05 },
])

let trainer: SimulatedTrainer
let engine: RideEngine
let recorder: RideRecorder

beforeEach(async () => {
  vi.useFakeTimers({ now: Date.parse('2026-10-12T09:30:00.000Z') })
  trainer = new SimulatedTrainer({ random: () => 0.5 })
  trainer.setSettings({ mode: 'fixed', basePowerW: 220 })
  await trainer.connect()
  engine = new RideEngine({ course, trainer, settings: DEFAULT_RIDER_SETTINGS, now: Date.now })
  recorder = new RideRecorder(engine, {
    id: 'r1',
    routeId: 'route',
    routeName: 'Test',
    settings: DEFAULT_RIDER_SETTINGS,
  })
})

afterEach(() => {
  engine.dispose()
  vi.useRealTimers()
})

describe('RideRecorder', () => {
  it('1 秒ごとにサンプルを記録し、一時停止をイベントとして残す', () => {
    engine.start()
    vi.advanceTimersByTime(30_000)
    engine.pause()
    vi.advanceTimersByTime(20_000)
    engine.resume()
    vi.advanceTimersByTime(10_000)
    engine.finish()
    const ride = recorder.finish()!

    expect(ride.samples).toHaveLength(40)
    // 時刻は秒単位で単調増加
    for (let i = 1; i < ride.samples.length; i++) {
      const dt = ride.samples[i]!.timestampMs - ride.samples[i - 1]!.timestampMs
      expect(dt % 1000).toBe(0)
      expect(dt).toBeGreaterThan(0)
    }
    expect(ride.events.map((e) => e.type)).toEqual(['start', 'stop', 'start', 'stop'])
    expect(ride.events[1]!.timestampMs - ride.events[0]!.timestampMs).toBe(30_000)
    expect(ride.stats.movingTimeS).toBeCloseTo(40, 0)
    expect(ride.stats.elapsedWallS).toBe(60)
    expect(ride.stats.averagePowerW).toBe(220)
    expect(ride.samples.at(-1)!.distanceM).toBeGreaterThan(100)
    expect(ride.samples[0]!.lat).toBeGreaterThan(45)
  })

  it('トレーナーの切断による自動一時停止も記録する', () => {
    engine.start()
    vi.advanceTimersByTime(5_000)
    trainer.simulateDropout(3000)
    vi.advanceTimersByTime(5_000)
    engine.finish()
    const ride = recorder.finish()!
    expect(ride.events.map((e) => e.type)).toEqual(['start', 'stop', 'start', 'stop'])
  })

  it('開始前に終了したら null', () => {
    expect(recorder.finish()).toBeNull()
  })
})
