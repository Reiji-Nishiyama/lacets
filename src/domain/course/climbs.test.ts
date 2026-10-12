import { describe, expect, it } from 'vitest'
import { northboundRoute } from '../../../test/helpers/syntheticRoute.ts'
import { detectClimbs } from './climbs.ts'
import { buildProfile } from './profile.ts'

describe('detectClimbs', () => {
  it('平坦 → 登り（途中に短い緩斜面）→ 平坦 → 短い坂、から 1 つの登りを検出する', () => {
    // 0-1000 平坦, 1000-3000 6%（1800-1900 は 1%）, 3000-4000 平坦, 4000-4200 8%（短いので対象外）
    const ele = (d: number) => {
      if (d < 1000) return 100
      if (d < 1800) return 100 + 0.06 * (d - 1000)
      if (d < 1900) return 148 + 0.01 * (d - 1800)
      if (d < 3000) return 149 + 0.06 * (d - 1900)
      if (d < 4000) return 215
      if (d < 4200) return 215 + 0.08 * (d - 4000)
      return 231
    }
    const { profile } = buildProfile(northboundRoute(5000, 10, ele), 'barometric')
    const climbs = detectClimbs(profile)
    expect(climbs).toHaveLength(1)
    expect(climbs[0]!.startM).toBeGreaterThan(950)
    expect(climbs[0]!.startM).toBeLessThan(1050)
    expect(climbs[0]!.endM).toBeGreaterThan(2950)
    expect(climbs[0]!.endM).toBeLessThan(3050)
    expect(climbs[0]!.averageGrade).toBeCloseTo(0.0575, 2)
  })

  it('平坦なルートには登りがない', () => {
    const { profile } = buildProfile(
      northboundRoute(3000, 10, () => 0),
      'barometric',
    )
    expect(detectClimbs(profile)).toEqual([])
  })
})
