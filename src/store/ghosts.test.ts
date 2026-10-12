import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { readFixture } from '../../test/helpers/fixtures.ts'
import { referenceToGpx } from '../../test/helpers/gpxWriter.ts'
import { sampleRide } from '../../test/helpers/recordedRide.ts'
import { simulatedReference } from '../../test/helpers/simulatedReference.ts'
import { db } from './db.ts'
import { listGhostOptions, loadGhost } from './ghosts.ts'
import { addReferenceFromFile } from './referenceRepository.ts'
import { buildRideReport } from './rideReport.ts'
import { saveRide } from './rideRepository.ts'
import { addRouteFromFile } from './routeRepository.ts'

beforeEach(async () => {
  await Promise.all([db.routes.clear(), db.rides.clear(), db.referenceRides.clear()])
})

async function setup() {
  const route = await addRouteFromFile('lacets.gpx', readFixture('synthetic-lacets.gpx'))
  const sim = simulatedReference(route.profile, { powerW: 250, waitS: 30 })
  const gpx = referenceToGpx('前年の実走', Date.parse('2025-06-08T06:30:00Z'), sim.samples)
  const reference = await addReferenceFromFile('2025.gpx', new TextEncoder().encode(gpx))
  // 別の場所の実走（ルートに重ならない）
  await addReferenceFromFile('elsewhere.gpx', readFixture('recorded-ride.gpx'))
  return { route, reference }
}

describe('listGhostOptions / loadGhost', () => {
  it('ルートに重なる実走データと、同じルートの過去の走行を選択肢にする', async () => {
    const { route, reference } = await setup()
    await saveRide({ ...sampleRide(), routeId: route.id })
    await saveRide({ ...sampleRide(), id: 'other-route', routeId: 'x' })
    const options = await listGhostOptions(route)
    expect(options.map((o) => o.ref)).toEqual([
      { kind: 'reference', id: reference.id },
      { kind: 'ride', id: 'ride-1' },
    ])
    expect(options[0]!.coverageRatio).toBeGreaterThan(0.95)
  })

  it('実走データを射影したゴーストを読み込む', async () => {
    const { route, reference } = await setup()
    const ghost = await loadGhost({ kind: 'reference', id: reference.id }, route)
    expect(ghost?.name).toBe('前年の実走')
    expect(ghost?.riderMassKg).toBeNull()
    expect(ghost?.track.timeAt(5000)).toBeGreaterThan(0)
  })

  it('過去の走行のゴーストは、その時の体重を使う', async () => {
    const { route } = await setup()
    await saveRide({ ...sampleRide(), routeId: route.id })
    const ghost = await loadGhost({ kind: 'ride', id: 'ride-1' }, route)
    expect(ghost?.riderMassKg).toBe(65)
    expect(ghost?.track.timeAt(100)).toBe(20)
  })

  it('見つからなければ null', async () => {
    const { route } = await setup()
    expect(await loadGhost({ kind: 'ride', id: 'nope' }, route)).toBeNull()
  })
})

describe('buildRideReport', () => {
  it('ゴーストと 1 km ごと・登りごとに比べる', async () => {
    const { route, reference } = await setup()
    // 実走データ自身を「ユーザーの走行」に見立てる: 差はほぼ 0 になるはず
    const ghost = (await loadGhost({ kind: 'reference', id: reference.id }, route))!
    const samples = Array.from({ length: Math.floor(ghost.track.durationS) }, (_, i) => ({
      ...sampleRide().samples[0]!,
      elapsedS: i + 1,
      distanceM: ghost.track.distanceAt(i + 1),
      powerW: 250,
    }))
    const ride = {
      ...sampleRide(),
      routeId: route.id,
      samples,
      stats: { ...sampleRide().stats, distanceM: samples.at(-1)!.distanceM },
      ghost: { kind: 'reference' as const, id: reference.id, name: ghost.name },
    }
    const report = await buildRideReport(ride)
    expect(report.ghostName).toBe('前年の実走')
    expect(report.kilometers).toHaveLength(14)
    expect(report.climbs.length).toBeGreaterThan(0)
    const first = report.kilometers[1]!
    expect(Math.abs(first.deltaS!)).toBeLessThan(2)
    expect(first.user?.averagePowerW).toBeCloseTo(250)
    expect(first.ghost?.averagePowerW).toBeCloseTo(250)
    expect(first.user?.wattsPerKg).toBeCloseTo(250 / 65)
  })

  it('ゴーストなしなら自分の区間タイムだけ', async () => {
    const { route } = await setup()
    const report = await buildRideReport({ ...sampleRide(), routeId: route.id })
    expect(report.ghostName).toBeNull()
    expect(report.kilometers[0]!.ghost).toBeNull()
    expect(report.kilometers[0]!.user).not.toBeNull()
  })
})
