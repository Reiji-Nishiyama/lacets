import { describe, expect, it } from 'vitest'
import { bearingDeg, cumulativeDistancesM, haversineM } from './geo.ts'

describe('geo', () => {
  it('緯度 0.001° ≈ 111.2 m', () => {
    expect(haversineM(45, 6, 45.001, 6)).toBeCloseTo(111.19, 1)
  })

  it('東京駅〜富士山頂 ≈ 100 km', () => {
    expect(haversineM(35.6812, 139.7671, 35.3606, 138.7274) / 1000).toBeCloseTo(100.4, 0)
  })

  it('方位', () => {
    expect(bearingDeg(45, 6, 46, 6)).toBeCloseTo(0)
    expect(bearingDeg(0, 0, 0, 1)).toBeCloseTo(90)
    expect(bearingDeg(46, 6, 45, 6)).toBeCloseTo(180)
    expect(bearingDeg(0, 1, 0, 0)).toBeCloseTo(270)
  })

  it('累積距離', () => {
    const d = cumulativeDistancesM([
      { lat: 45, lon: 6 },
      { lat: 45.001, lon: 6 },
      { lat: 45.002, lon: 6 },
    ])
    expect(d[0]).toBe(0)
    expect(d[2]).toBeCloseTo(222.39, 1)
  })
})
