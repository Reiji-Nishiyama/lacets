import { describe, expect, it } from 'vitest'
import { readFixture } from '../../../test/helpers/fixtures.ts'
import { northboundRoute } from '../../../test/helpers/syntheticRoute.ts'
import { importRoute } from './importRoute.ts'
import { buildProfile } from './profile.ts'
import { reversedProfile } from './reverse.ts'
import { detectHairpins, passedMarkers, progressMarkers } from './progressMarkers.ts'

const lacets = importRoute(readFixture('synthetic-lacets.gpx'), 'x')

describe('detectHairpins', () => {
  it('合成のつづら折り（21 の折り返し）を数える', () => {
    const hairpins = detectHairpins(lacets.profile)
    expect(hairpins).toHaveLength(21)
    // 折り返しは 13.8 km / 22 区間 ≈ 627 m ごと
    const gaps = hairpins.slice(1).map((d, i) => d - hairpins[i]!)
    for (const g of gaps) expect(g).toBeGreaterThan(550)
  })

  it('まっすぐな道にはない', () => {
    const { profile } = buildProfile(
      northboundRoute(3000, 10, () => 0),
      'dem',
    )
    expect(detectHairpins(profile)).toEqual([])
  })
})

describe('progressMarkers', () => {
  it('ヘアピンのある峠はヘアピンの印', () => {
    const m = progressMarkers(lacets.profile)
    expect(m.kind).toBe('hairpin')
    expect(m.positionsM).toHaveLength(21)
  })

  it('ヘアピンのない登りは標高 100 m ごと', () => {
    const { profile } = buildProfile(
      northboundRoute(10_000, 10, (d) => 800 + 0.06 * d),
      'dem',
    )
    const m = progressMarkers(profile)
    expect(m).toMatchObject({ kind: 'elevation', stepM: 100 })
    expect(m.positionsM).toHaveLength(5) // 600 m 登る → 100〜500 m の 5 つ（600 m ちょうどは平滑化で届かない場合あり）
    expect(m.positionsM[0]).toBeGreaterThan(1600)
    expect(m.positionsM[0]).toBeLessThan(1700)
  })

  it('大きく登るルートは段を大きくして 30 個以下にする', () => {
    const { profile } = buildProfile(
      northboundRoute(60_000, 10, (d) => 0.06 * d),
      'dem',
    )
    const m = progressMarkers(profile)
    expect(m.kind).toBe('elevation')
    expect(m.stepM).toBe(200)
    expect(m.positionsM.length).toBeLessThanOrEqual(30)
  })

  it('平坦や下りは距離の印（長いルートは段を大きくする）', () => {
    const flat = buildProfile(
      northboundRoute(12_500, 10, () => 50),
      'dem',
    ).profile
    expect(progressMarkers(flat)).toMatchObject({ kind: 'distance', stepM: 1000 })
    expect(progressMarkers(flat).positionsM).toHaveLength(12)
    const long = buildProfile(
      northboundRoute(100_000, 50, () => 50),
      'dem',
    ).profile
    expect(progressMarkers(long).stepM).toBe(5000)
  })

  it('逆方向（下り）のつづら折りもヘアピンの印', () => {
    const rev = reversedProfile(lacets.points, lacets.elevationSource)
    expect(progressMarkers(rev.profile).kind).toBe('hairpin')
  })

  it('越えた印の数', () => {
    const m = { kind: 'distance' as const, stepM: 1000, positionsM: [1000, 2000, 3000] }
    expect(passedMarkers(m, 999)).toBe(0)
    expect(passedMarkers(m, 2000)).toBe(2)
  })
})
