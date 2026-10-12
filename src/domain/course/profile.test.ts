import { describe, expect, it } from 'vitest'
import { northboundRoute } from '../../../test/helpers/syntheticRoute.ts'
import { buildProfile, centralDifference } from './profile.ts'

const mid = <T>(xs: T[], margin: number) => xs.slice(margin, xs.length - margin)

describe('buildProfile', () => {
  it('10 m 間隔に再サンプルし、終点を含める', () => {
    const { profile, stats } = buildProfile(
      northboundRoute(1005, 25, () => 100),
      'dem',
    )
    expect(profile[0]?.distanceM).toBe(0)
    expect(profile[1]?.distanceM).toBe(10)
    expect(profile.at(-1)?.distanceM).toBeCloseTo(1000, 0) // 25 m 間隔なので 1000 m で終わる
    expect(stats.distanceM).toBeCloseTo(1000, 0)
    expect(profile).toHaveLength(101)
  })

  it('一定勾配 8% の登り', () => {
    const { profile, stats, hasElevation } = buildProfile(
      northboundRoute(2000, 20, (d) => 700 + 0.08 * d),
      'dem',
    )
    expect(hasElevation).toBe(true)
    for (const p of profile) expect(p.grade).toBeCloseTo(0.08, 6)
    expect(stats.ascentM).toBeCloseTo(160, 6)
    expect(stats.descentM).toBeCloseTo(0, 6)
  })

  it('DEM の段差・スパイクは中央値フィルタと移動平均で均す', () => {
    // 5% の登りに、1 点だけ +30 m のスパイクと 3 m 刻みの段差を加える
    const route = northboundRoute(2000, 10, (d) => {
      const base = 3 * Math.floor((500 + 0.05 * d) / 3)
      return d === 1000 ? base + 30 : base
    })
    const { stats, steepSections } = buildProfile(route, 'dem')
    expect(stats.maxGrade).toBeLessThan(0.07)
    expect(stats.minGrade).toBeGreaterThan(0.03)
    expect(steepSections).toEqual([])
  })

  it('気圧高度は軽い平滑化なので短い急坂が残る', () => {
    // 1000〜1100 m だけ 15%、他は 3%
    const elevationAt = (d: number) => {
      if (d < 1000) return 0.03 * d
      if (d < 1100) return 30 + 0.15 * (d - 1000)
      return 45 + 0.03 * (d - 1100)
    }
    const baro = buildProfile(northboundRoute(2000, 10, elevationAt), 'barometric')
    const dem = buildProfile(northboundRoute(2000, 10, elevationAt), 'dem')
    expect(baro.stats.maxGrade).toBeGreaterThan(0.13)
    expect(dem.stats.maxGrade).toBeLessThan(baro.stats.maxGrade)
  })

  it('±25% を超える勾配は補間し、区間を報告する', () => {
    // 1000 m 地点に 20 m の崖（データの誤り）
    const route = northboundRoute(2000, 10, (d) => (d < 1000 ? 0.02 * d : 0.02 * d + 20))
    const { profile, steepSections } = buildProfile(route, 'barometric', { gradeHalfWindow: 2 })
    expect(steepSections.length).toBeGreaterThan(0)
    for (const p of profile) expect(Math.abs(p.grade)).toBeLessThanOrEqual(0.25)
  })

  it('標高がなければ勾配 0', () => {
    const { profile, hasElevation, stats } = buildProfile(
      northboundRoute(500, 50, () => undefined),
      'dem',
    )
    expect(hasElevation).toBe(false)
    expect(profile.every((p) => p.grade === 0 && p.elevationM === 0)).toBe(true)
    expect(stats.ascentM).toBe(0)
  })

  it('一部欠けた標高は距離で補間する', () => {
    const route = northboundRoute(400, 100, (d) => (d === 200 ? undefined : d * 0.1))
    const { profile } = buildProfile(route, 'barometric', { gradeHalfWindow: 2 })
    for (const p of mid(profile, 5)) expect(p.grade).toBeCloseTo(0.1, 3)
  })

  it('重複点を除き、1 点しかなければエラー', () => {
    const p = { lat: 45, lon: 6, elevationM: 0 }
    expect(() => buildProfile([p, p, p], 'dem')).toThrow()
  })
})

describe('centralDifference', () => {
  it('端では片側に縮める', () => {
    expect(centralDifference([0, 10, 20], [0, 1, 4], 1)).toEqual([0.1, 0.2, 0.3])
  })
})
