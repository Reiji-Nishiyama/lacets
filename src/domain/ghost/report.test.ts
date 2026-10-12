import { describe, expect, it } from 'vitest'
import { climbSegments, compareSegments, kilometerSegments } from './report.ts'
import { TimedTrack } from './TimedTrack.ts'

const track = (speedMps: number, powerW: number, lengthM = 2500) =>
  TimedTrack.fromSamples(
    Array.from({ length: Math.ceil(lengthM / speedMps) + 1 }, (_, t) => ({
      distanceM: Math.min(lengthM, t * speedMps),
      timeS: t,
      powerW,
    })),
    0,
  )

describe('kilometerSegments', () => {
  it('途中の地点から: ルート上の km の区切りに合わせ、最初と最後は端数', () => {
    expect(kilometerSegments(2400, 4700).map((s) => [s.startM, s.endM])).toEqual([
      [2400, 3000],
      [3000, 4000],
      [4000, 4700],
    ])
  })

  it('1 km ごと、最後は端数', () => {
    expect(kilometerSegments(0, 2500).map((s) => [s.startM, s.endM])).toEqual([
      [0, 1000],
      [1000, 2000],
      [2000, 2500],
    ])
  })
})

describe('compareSegments', () => {
  it('区間ごとのタイム・平均パワー・W/kg と時間差', () => {
    const user = track(5, 250)
    const ghost = track(4, 220)
    const rows = compareSegments(kilometerSegments(0, 2500), user, ghost, 62.5, 55)
    expect(rows[0]!.user).toEqual({ timeS: 200, averagePowerW: 250, wattsPerKg: 4 })
    expect(rows[0]!.ghost).toEqual({ timeS: 250, averagePowerW: 220, wattsPerKg: 4 })
    expect(rows[0]!.deltaS).toBe(-50)
    expect(rows[2]!.deltaS).toBe(-25)
  })

  it('ゴーストがない・カバーしていない区間は null', () => {
    const user = track(5, 250)
    const shortGhost = track(4, 220, 1500)
    const rows = compareSegments(kilometerSegments(0, 2500), user, shortGhost, 60)
    expect(rows[1]!.ghost).toBeNull()
    expect(rows[1]!.deltaS).toBeNull()
    expect(compareSegments(kilometerSegments(0, 2500), user, null, 60)[0]!.ghost).toBeNull()
  })

  it('登り区間', () => {
    const segs = climbSegments([{ startM: 500, endM: 2000, ascentM: 90, averageGrade: 0.06 }])
    const rows = compareSegments(segs, track(5, 250), null, 60)
    expect(rows[0]!.segment.averageGrade).toBe(0.06)
    expect(rows[0]!.user?.timeS).toBe(300)
  })

  it('ゴーストがスタートの少し先から始まる場合は、重なる範囲で比べる', () => {
    const user = track(5, 250)
    // 15 m 地点から始まるゴースト（スタート前の待機を除いた実走）
    const ghost = TimedTrack.fromSamples(
      Array.from({ length: 700 }, (_, t) => ({
        distanceM: Math.min(2500, 15 + t * 4),
        timeS: t,
        powerW: 220,
      })),
      0,
    )
    const rows = compareSegments(kilometerSegments(0, 2500), user, ghost, 60)
    // 15〜1000 m: 自分 197 秒、ゴースト 246.25 秒
    expect(rows[0]!.user?.timeS).toBeCloseTo(197)
    expect(rows[0]!.ghost?.timeS).toBeCloseTo(246.25)
    expect(rows[0]!.deltaS).toBeCloseTo(-49.25)
    // 範囲が 100 m 以上ずれる区間は比べない
    const far = TimedTrack.fromSamples([
      { distanceM: 500, timeS: 0 },
      { distanceM: 2500, timeS: 500 },
    ])
    const farRows = compareSegments(kilometerSegments(0, 2500), user, far, 60)
    expect(farRows[0]!.ghost).toBeNull()
    expect(farRows[0]!.user?.timeS).toBe(200)
    expect(farRows[1]!.ghost?.timeS).toBe(250)
  })
})
