import { describe, expect, it } from 'vitest'
import { GhostComparator } from './GhostComparator.ts'
import { TimedTrack } from './TimedTrack.ts'

// 10 m/s で 1000 m 走るゴースト
const ghost = TimedTrack.fromSamples(
  Array.from({ length: 101 }, (_, i) => ({ distanceM: i * 10, timeS: i })),
  0,
)

describe('GhostComparator', () => {
  it('同じ距離での時間差と、同じ時刻でのゴーストの位置', () => {
    const c = new GhostComparator(ghost)
    // 走行開始時（経過 0 秒・始点）の状態が最初に届く
    expect(c.update(0, 0)).toEqual({ deltaS: 0, ghostDistanceM: 0 })
    // ユーザーは 8 m/s: 400 m に 50 秒で到達、ゴーストは 40 秒
    expect(c.update(400, 50)).toEqual({ deltaS: 10, ghostDistanceM: 500 })
    // ゴーストの終点を過ぎたら差は出さず、ゴーストは終点に留まる
    expect(c.update(1001, 130)).toEqual({ deltaS: null, ghostDistanceM: 1000 })
  })

  it('途中から始まるゴーストは、ユーザーが開始距離を通過した時刻を基準にする', () => {
    const partial = TimedTrack.fromSamples(
      Array.from({ length: 51 }, (_, i) => ({ distanceM: 500 + i * 10, timeS: 1000 + i })),
      0,
    )
    const c = new GhostComparator(partial)
    expect(c.update(100, 10)).toEqual({ deltaS: null, ghostDistanceM: 500 })
    expect(c.update(500, 60).deltaS).toBe(0)
    expect(c.update(600, 68)).toEqual({ deltaS: -2, ghostDistanceM: 580 })
  })

  it('ルートの途中から走り始めた場合は、その地点のゴーストの時刻を基準にする', () => {
    const c = new GhostComparator(ghost)
    // 300 m 地点から開始（ゴーストは 30 秒時点で通過）。ユーザーは 8 m/s
    expect(c.update(300, 0)).toEqual({ deltaS: 0, ghostDistanceM: 300 })
    // 400 m に 12.5 秒で到達、ゴーストは 300→400 m に 10 秒
    expect(c.update(400, 12.5)).toEqual({ deltaS: 2.5, ghostDistanceM: 425 })
  })

  it('ゴーストの終点より先から走り始めたら比べない', () => {
    const c = new GhostComparator(ghost)
    expect(c.update(1200, 0).deltaS).toBeNull()
    expect(c.update(1300, 10).deltaS).toBeNull()
  })
})
