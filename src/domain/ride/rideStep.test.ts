import { describe, expect, it } from 'vitest'
import { Course } from '../course/Course.ts'
import { DEFAULT_PHYSICS, steadySpeedMps } from '../physics/model.ts'
import { INITIAL_PROGRESS, stepRide } from './rideStep.ts'

const physics = { ...DEFAULT_PHYSICS, totalMassKg: 78, cdaM2: 0.32, crr: 0.004 }
const flat = (lengthM: number) =>
  new Course([
    { distanceM: 0, lat: 45, lon: 6, elevationM: 0, grade: 0 },
    { distanceM: lengthM, lat: 45.01, lon: 6, elevationM: 0, grade: 0 },
  ])

describe('stepRide', () => {
  it('パワーで進み、経過時間を積算する', () => {
    let p = INITIAL_PROGRESS
    for (let i = 0; i < 4 * 60; i++) p = stepRide(p, 200, 0.25, flat(10_000), physics)
    expect(p.elapsedS).toBeCloseTo(60)
    expect(p.speedMps).toBeGreaterThan(8)
    expect(p.distanceM).toBeGreaterThan(300)
    expect(p.finished).toBe(false)
  })

  it('終点で finished になり、距離は終点にクランプ、時刻は補間する', () => {
    const v = steadySpeedMps(200, 0, physics)
    const start = { elapsedS: 100, distanceM: 1000 - v * 0.5, speedMps: v, finished: false }
    const p = stepRide(start, 200, 1, flat(1000), physics)
    expect(p.finished).toBe(true)
    expect(p.distanceM).toBe(1000)
    expect(p.elapsedS).toBeCloseTo(100.5, 1)
    // 終了後は進まない
    expect(stepRide(p, 300, 1, flat(1000), physics)).toBe(p)
  })

  it('勾配はコース上の現在地の値を使う', () => {
    const climb = new Course([
      { distanceM: 0, lat: 45, lon: 6, elevationM: 0, grade: 0.08 },
      { distanceM: 10_000, lat: 45.1, lon: 6, elevationM: 800, grade: 0.08 },
    ])
    let p = INITIAL_PROGRESS
    for (let i = 0; i < 4 * 120; i++) p = stepRide(p, 250, 0.25, climb, physics)
    expect(p.speedMps).toBeCloseTo(steadySpeedMps(250, 0.08, physics), 2)
  })
})
