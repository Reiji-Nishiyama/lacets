import { describe, expect, it } from 'vitest'
import { bestIndex, fullRouteTimeS } from './personalBest.ts'
import { TimedTrack } from './TimedTrack.ts'

const track = (fromM: number, toM: number, speedMps = 5) =>
  TimedTrack.fromSamples(
    Array.from({ length: 101 }, (_, i) => {
      const d = fromM + ((toM - fromM) * i) / 100
      return { distanceM: d, timeS: (d - fromM) / speedMps }
    }),
    0,
  )

describe('fullRouteTimeS', () => {
  it('スタートからゴールまで走った記録はタイムを返す', () => {
    expect(fullRouteTimeS(track(0, 1000), 1000)).toBeCloseTo(200, 6)
    // ゴールの少し手前で終わっても、GPS の誤差の範囲なら走り切ったとみなす
    expect(fullRouteTimeS(track(5, 980), 1000)).toBeCloseTo(195, 6)
  })

  it('途中から走った・途中でやめた記録は null', () => {
    expect(fullRouteTimeS(track(300, 1000), 1000)).toBeNull()
    expect(fullRouteTimeS(track(0, 800), 1000)).toBeNull()
  })
})

describe('bestIndex', () => {
  it('いちばん短いタイム。null は除き、同じなら先のもの', () => {
    expect(bestIndex([null, 300, 250, 250])).toBe(2)
    expect(bestIndex([null, null])).toBe(-1)
    expect(bestIndex([])).toBe(-1)
  })
})
