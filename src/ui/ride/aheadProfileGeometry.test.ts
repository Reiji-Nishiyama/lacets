import { describe, expect, it } from 'vitest'
import { aheadProfileGeometry } from './aheadProfileGeometry.ts'

const climb = (grade: number) => (d: number) => 700 + grade * d

describe('aheadProfileGeometry', () => {
  it('2 km 先までを 250 m ごとに分け、区間の勾配を求める', () => {
    const g = aheadProfileGeometry(climb(0.08), 13_800, 6_400)
    expect(g.slices).toHaveLength(8)
    for (const s of g.slices) expect(s.grade).toBeCloseTo(0.08, 6)
    expect(g.endM).toBe(8_400)
    expect(g.goalInWindow).toBe(false)
    expect(g.next500Grade).toBeCloseTo(0.08, 6)
    // 左端が現在地、右端が 2 km 先。登りなので右ほど高い（y が小さい）
    expect(g.x(6_400)).toBe(8)
    expect(g.x(8_400)).toBe(432)
    expect(g.y(700 + 0.08 * 8_400)).toBeLessThan(g.y(700 + 0.08 * 6_400))
  })

  it('ゴールが近ければゴールまで。横軸は 2 km のまま', () => {
    const g = aheadProfileGeometry(climb(0.05), 1_000, 400)
    expect(g.endM).toBe(1_000)
    expect(g.goalInWindow).toBe(true)
    expect(g.slices).toHaveLength(3) // 250 + 250 + 100
    expect(g.x(1_000)).toBeCloseTo(8 + (600 / 2000) * 424, 6)
  })

  it('平坦でも縦軸が潰れない。ゴールの直前は次の 500 m の勾配を出さない', () => {
    const flat = aheadProfileGeometry(() => 100, 5_000, 0)
    expect(flat.line).not.toContain('NaN')
    expect(flat.slices[0]!.grade).toBe(0)
    expect(aheadProfileGeometry(() => 100, 5_000, 4_950).next500Grade).toBeNull()
  })
})
