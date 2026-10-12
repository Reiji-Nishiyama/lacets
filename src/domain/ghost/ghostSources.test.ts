import { describe, expect, it } from 'vitest'
import { readFixture } from '../../../test/helpers/fixtures.ts'
import { simulatedReference } from '../../../test/helpers/simulatedReference.ts'
import { importRoute } from '../course/importRoute.ts'
import { parseRouteFile } from '../course/parsers/index.ts'
import { ghostFromRecordedRide, ghostFromReference, referenceSamplesFrom } from './ghostSources.ts'

const route = importRoute(readFixture('synthetic-lacets.gpx'), 'x')

describe('ghostFromReference', () => {
  it('GPS の揺れ・スタート前の待機・ゴール後の下山があっても、到達時刻を数秒以内で再現する', () => {
    const ref = simulatedReference(route.profile, {
      powerW: 250,
      waitS: 120,
      descentS: 600,
      gpsNoiseM: 5,
    })
    const ghost = ghostFromReference(route.profile, ref)
    expect(ghost.coverageRatio).toBeGreaterThan(0.99)
    expect(ghost.matchedRatio).toBeGreaterThan(0.9) // 下山区間は一致しない
    // ゴーストの時刻 0 は開始距離 coveredFromM（スタート地点を離れた点）。真値も同じ基準で比べる
    const start = ghost.track.coveredFromM
    expect(start).toBeLessThan(25)
    const trueFromStart = (d: number) => ref.trueTimeAt(d) - ref.trueTimeAt(start)
    for (const d of [1000, 5000, 10_000, 13_000]) {
      expect(Math.abs(ghost.track.timeAt(d)! - trueFromStart(d))).toBeLessThan(2)
    }
    expect(Math.abs(ghost.track.durationS - trueFromStart(route.stats.distanceM))).toBeLessThan(3)
  })

  it('別の場所の記録は一致しない', () => {
    const elsewhere = simulatedReference(
      route.profile.map((p) => ({ ...p, lat: p.lat + 0.1 })),
      { powerW: 250 },
    )
    const ghost = ghostFromReference(route.profile, elsewhere)
    expect(ghost.coverageRatio).toBe(0)
  })

  it('ルートの途中からの記録は、その区間だけをカバーする', () => {
    const ref = simulatedReference(route.profile, { powerW: 250 })
    const t5k = ref.trueTimeAt(5000)
    const partial = { samples: ref.samples.filter((s) => s.timeS >= t5k) }
    const ghost = ghostFromReference(route.profile, partial)
    expect(ghost.track.coveredFromM).toBeGreaterThan(4900)
    expect(ghost.coverageRatio).toBeGreaterThan(0.6)
    expect(ghost.coverageRatio).toBeLessThan(0.65)
  })
})

describe('ghostFromRecordedRide', () => {
  it('Lacets の走行は距離と走行時間をそのまま使う', () => {
    const track = ghostFromRecordedRide([
      { distanceM: 3, elapsedS: 1, powerW: 200 },
      { distanceM: 8, elapsedS: 2, powerW: 200 },
      { distanceM: 15, elapsedS: 3, powerW: 210 },
    ])
    expect(track.timeAt(0)).toBe(0)
    expect(track.timeAt(8)).toBe(2)
    expect(track.averagePowerBetween(1, 3)).toBeCloseTo(200)
  })
})

describe('referenceSamplesFrom', () => {
  it('時刻付きの記録はゴースト用サンプルにし、センサー値を残す', () => {
    const samples = referenceSamplesFrom(parseRouteFile(readFixture('recorded-ride.gpx')))
    expect(samples).toHaveLength(3)
    expect(samples?.[0]).toMatchObject({ timeS: 0, heartRateBpm: 150 })
  })

  it('時刻のないルートは null', () => {
    expect(referenceSamplesFrom(parseRouteFile(readFixture('track-two-segments.gpx')))).toBeNull()
  })
})
