import { describe, expect, it } from 'vitest'
import { mpsToKmh } from '../units.ts'
import {
  DEFAULT_PHYSICS,
  advance,
  resistanceN,
  steadySpeedMps,
  type PhysicsParams,
} from './model.ts'

const params = (totalMassKg: number, cdaM2 = 0.32): PhysicsParams => ({
  ...DEFAULT_PHYSICS,
  totalMassKg,
  cdaM2,
  crr: 0.004,
})

describe('定常速度（docs/02-architecture.md §5 の目安）', () => {
  it('平坦 200 W・75 kg（+バイク 8 kg）で 33〜35 km/h', () => {
    const kmh = mpsToKmh(steadySpeedMps(200, 0, params(83)))
    expect(kmh).toBeGreaterThan(33)
    expect(kmh).toBeLessThan(35)
  })

  it('8% 登坂 250 W・70 kg（+バイク 8 kg）で約 14 km/h（13〜15）', () => {
    const kmh = mpsToKmh(steadySpeedMps(250, 0.08, params(78)))
    expect(kmh).toBeGreaterThan(13)
    expect(kmh).toBeLessThan(15)
  })

  it('P = 0 の登りでは 0、P = 0 の下りでは釣り合いの速度まで出る', () => {
    expect(steadySpeedMps(0, 0.05, params(75))).toBe(0)
    const kmh = mpsToKmh(steadySpeedMps(0, -0.08, params(75)))
    expect(kmh).toBeGreaterThan(50)
    expect(kmh).toBeLessThan(80)
  })

  it('向かい風で遅くなる', () => {
    expect(steadySpeedMps(200, 0, params(75), 5)).toBeLessThan(steadySpeedMps(200, 0, params(75)))
  })
})

describe('advance（積分）', () => {
  it('一定パワーで定常速度に収束する', () => {
    const p = params(78)
    let s = { speedMps: 0, distanceM: 0 }
    for (let i = 0; i < 4 * 120; i++) s = advance(s, 250, 0.08, 0.25, p)
    expect(s.speedMps).toBeCloseTo(steadySpeedMps(250, 0.08, p), 2)
  })

  it('距離は速度の積分', () => {
    const p = params(83)
    const v = steadySpeedMps(200, 0, p)
    const s = advance({ speedMps: v, distanceM: 100 }, 200, 0, 10, p)
    expect(s.distanceM).toBeCloseTo(100 + v * 10, 1)
  })

  it('静止状態から踏み出せる（v_min で P/v の発散を防ぐ）', () => {
    const s = advance({ speedMps: 0, distanceM: 0 }, 300, 0.1, 1, params(75))
    expect(s.speedMps).toBeGreaterThan(0)
    expect(Number.isFinite(s.speedMps)).toBe(true)
  })

  it('登りで踏むのをやめると減速して止まり、後ろには下がらない', () => {
    let s = { speedMps: 4, distanceM: 0 }
    for (let i = 0; i < 40; i++) s = advance(s, 0, 0.1, 0.25, params(75))
    expect(s.speedMps).toBe(0)
    const stopped = s.distanceM
    s = advance(s, 0, 0.1, 5, params(75))
    expect(s.distanceM).toBe(stopped)
  })

  it('平坦で踏むのをやめると惰性で進みながら減速する', () => {
    const s = advance({ speedMps: 10, distanceM: 0 }, 0, 0, 5, params(75))
    expect(s.speedMps).toBeLessThan(10)
    expect(s.speedMps).toBeGreaterThan(7)
    expect(s.distanceM).toBeGreaterThan(40)
  })

  it('dt ≤ 0 は何もしない', () => {
    const s = { speedMps: 5, distanceM: 10 }
    expect(advance(s, 200, 0, 0, params(75))).toBe(s)
  })
})

describe('resistanceN', () => {
  it('静止・平坦では転がり抵抗のみ', () => {
    expect(resistanceN(0, 0, params(100))).toBeCloseTo(100 * 9.80665 * 0.004)
  })

  it('追い風が速度を上回ると空気抵抗は負（押される）', () => {
    expect(resistanceN(2, 0, { ...params(75), crr: 0 }, -5)).toBeLessThan(0)
  })
})
