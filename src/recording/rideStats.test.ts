import { describe, expect, it } from 'vitest'
import { sampleRide } from '../../test/helpers/recordedRide.ts'
import { computeRideStats } from './rideStats.ts'

describe('computeRideStats', () => {
  it('走行時間・距離・獲得標高・平均値を求める', () => {
    const { stats } = sampleRide()
    expect(stats.movingTimeS).toBe(90)
    expect(stats.elapsedWallS).toBe(120)
    expect(stats.distanceM).toBe(450)
    expect(stats.ascentM).toBeCloseTo(35.6)
    expect(stats.averagePowerW).toBeCloseTo(210)
    expect(stats.maxPowerW).toBe(220)
    expect(stats.averageSpeedMps).toBeCloseTo(5)
    expect(stats.averageCadenceRpm).toBe(85) // 0 を除く
    expect(stats.averageHeartRateBpm).toBe(140) // 欠測を除く
    expect(stats.maxHeartRateBpm).toBe(140)
  })

  it('途中から走った記録の距離・平均速度は開始地点からの差', () => {
    const base = sampleRide()
    const samples = base.samples.map((x) => ({ ...x, distanceM: 5000 + x.distanceM }))
    const stats = computeRideStats(samples, base.startedAtMs, base.endedAtMs, 5000)
    expect(stats.distanceM).toBe(450)
    expect(stats.averageSpeedMps).toBeCloseTo(5)
  })

  it('サンプルがなくても落ちない', () => {
    const stats = computeRideStats([], 0, 1000)
    expect(stats.distanceM).toBe(0)
    expect(stats.averageHeartRateBpm).toBeNull()
    expect(stats.averageCadenceRpm).toBeNull()
  })
})
