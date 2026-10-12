import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { Course } from '../domain/course/Course.ts'
import { DEFAULT_RIDER_SETTINGS } from '../domain/rider.ts'
import { SimulatedTrainer } from '../devices/sim/SimulatedTrainer.ts'
import { RideEngine, type RideSnapshot, type RideTick } from './RideEngine.ts'

/** 1 km、前半平坦・後半 8% のコース */
const course = new Course([
  { distanceM: 0, lat: 45, lon: 6, elevationM: 0, grade: 0 },
  { distanceM: 500, lat: 45.0045, lon: 6, elevationM: 0, grade: 0 },
  { distanceM: 510, lat: 45.00459, lon: 6, elevationM: 0.8, grade: 0.08 },
  { distanceM: 1000, lat: 45.009, lon: 6, elevationM: 40, grade: 0.08 },
])

let trainer: SimulatedTrainer
let engine: RideEngine
let setSimulation: MockInstance<SimulatedTrainer['setSimulation']>

beforeEach(async () => {
  vi.useFakeTimers()
  trainer = new SimulatedTrainer({ random: () => 0.5 })
  trainer.setSettings({ mode: 'fixed', basePowerW: 250 })
  setSimulation = vi.spyOn(trainer, 'setSimulation')
  await trainer.connect()
  engine = new RideEngine({
    course,
    trainer,
    settings: DEFAULT_RIDER_SETTINGS,
    now: () => Date.now(),
  })
})

afterEach(() => {
  engine.dispose()
  vi.useRealTimers()
})

const grades = () => setSimulation.mock.calls.map((c) => c[0].grade)

describe('RideEngine', () => {
  it('開始するとパワーで進み、経過時間・速度・距離が増える', () => {
    engine.start()
    expect(engine.snapshot.status).toBe('running')
    vi.advanceTimersByTime(30_000)
    const s = engine.snapshot
    expect(s.elapsedS).toBeCloseTo(30, 0)
    expect(s.distanceM).toBeGreaterThan(150)
    expect(s.speedMps).toBeGreaterThan(5)
    expect(s.powerW).toBe(250)
    expect(s.remainingM).toBeCloseTo(1000 - s.distanceM)
  })

  it('開始時に勾配を送り、登りに入ると 8% を送る', () => {
    engine.start()
    expect(grades()[0]).toBe(0)
    vi.advanceTimersByTime(180_000)
    expect(Math.max(...grades())).toBeCloseTo(0.08)
  })

  it('難易度を掛けた勾配を送る', () => {
    engine.dispose()
    engine = new RideEngine({
      course,
      trainer,
      settings: { ...DEFAULT_RIDER_SETTINGS, difficulty: 0.5 },
      now: () => Date.now(),
    })
    engine.start()
    vi.advanceTimersByTime(180_000)
    expect(Math.max(...grades())).toBeCloseTo(0.04)
  })

  it('勾配の送信は間引かれる（変化がなければ 1 秒に 1 回）', () => {
    engine.start()
    vi.advanceTimersByTime(10_000) // 平坦区間のみ
    expect(setSimulation.mock.calls.length).toBeLessThanOrEqual(12)
    expect(setSimulation.mock.calls.length).toBeGreaterThanOrEqual(9)
  })

  it('一時停止中は進まず時間も止まる。再開で続きから', () => {
    engine.start()
    vi.advanceTimersByTime(10_000)
    engine.pause()
    const paused = engine.snapshot
    expect(paused.status).toBe('paused')
    expect(paused.speedMps).toBe(0)
    vi.advanceTimersByTime(10_000)
    expect(engine.snapshot.distanceM).toBe(paused.distanceM)
    expect(engine.snapshot.elapsedS).toBe(paused.elapsedS)
    engine.resume()
    vi.advanceTimersByTime(5_000)
    expect(engine.snapshot.elapsedS).toBeCloseTo(15, 0)
    expect(engine.snapshot.distanceM).toBeGreaterThan(paused.distanceM)
  })

  it('トレーナーが切断されたら自動で一時停止し、再接続で再開する', () => {
    const statuses: string[] = []
    engine.onSnapshot((s: RideSnapshot) => {
      if (statuses.at(-1) !== s.status) statuses.push(s.status)
    })
    engine.start()
    vi.advanceTimersByTime(5_000)
    trainer.simulateDropout(3000)
    expect(engine.snapshot.status).toBe('autoPaused')
    const at = engine.snapshot.elapsedS
    vi.advanceTimersByTime(2_000)
    expect(engine.snapshot.elapsedS).toBe(at)
    vi.advanceTimersByTime(1_500)
    expect(engine.snapshot.status).toBe('running')
    expect(statuses).toEqual(['running', 'autoPaused', 'running'])
  })

  it('終点に着いたら finished になり、ループを止める', () => {
    const finished = vi.fn()
    engine.onSnapshot((s) => s.status === 'finished' && finished())
    engine.start()
    vi.advanceTimersByTime(600_000)
    const s = engine.snapshot
    expect(s.status).toBe('finished')
    expect(s.distanceM).toBe(1000)
    expect(s.remainingM).toBe(0)
    expect(finished).toHaveBeenCalledTimes(1)
  })

  it('途中終了できる', () => {
    engine.start()
    vi.advanceTimersByTime(5_000)
    engine.finish()
    expect(engine.snapshot.status).toBe('finished')
    expect(engine.snapshot.distanceM).toBeLessThan(1000)
  })

  it('記録ティックはおよそ 1 秒ごと', () => {
    const ticks: RideTick[] = []
    engine.onRecordTick((t) => ticks.push(t))
    engine.start()
    vi.advanceTimersByTime(10_000)
    expect(ticks).toHaveLength(10)
    for (const t of ticks) expect(t.dtS).toBeCloseTo(1)
  })

  it('トレーナーのデータが途絶えたらパワー 0 とみなす', () => {
    engine.start()
    vi.advanceTimersByTime(5_000)
    // 状態は connected のままデータだけ止める（private メソッドを直接呼ぶ）
    ;(trainer as unknown as { stopTicking: () => void }).stopTicking()
    vi.advanceTimersByTime(3_000)
    expect(engine.snapshot.powerW).toBe(0)
  })

  it('トレーナー未接続で開始すると autoPaused で待つ', async () => {
    await trainer.disconnect()
    engine.start()
    expect(engine.snapshot.status).toBe('autoPaused')
    await trainer.connect()
    expect(engine.snapshot.status).toBe('running')
  })
})
