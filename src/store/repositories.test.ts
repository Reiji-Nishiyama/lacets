import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFixture } from '../../test/helpers/fixtures.ts'
import { DEFAULT_RIDER_SETTINGS } from '../domain/rider.ts'
import { createDb, type LacetsDb } from './db.ts'
import { sampleRide } from '../../test/helpers/recordedRide.ts'
import { addReferenceFromFile, getReference, listReferences } from './referenceRepository.ts'
import { getRide, listRides, saveRide } from './rideRepository.ts'
import {
  addRouteFromFile,
  deleteRoute,
  getRoute,
  listRoutes,
  renameRoute,
} from './routeRepository.ts'
import { loadRiderSettings, saveRiderSettings } from './settingsRepository.ts'

let db: LacetsDb

beforeEach(() => {
  db = createDb(`test-${crypto.randomUUID()}`)
})

afterEach(async () => {
  await db.delete()
})

describe('routeRepository', () => {
  it('ファイルから取り込んで保存し、新しい順に一覧できる', async () => {
    const a = await addRouteFromFile(
      'track-two-segments.gpx',
      readFixture('track-two-segments.gpx'),
      db,
    )
    await new Promise((r) => setTimeout(r, 2))
    const b = await addRouteFromFile('my-ride.tcx', readFixture('activity.tcx'), db)
    expect(a.name).toBe('テスト峠')
    expect(b.name).toBe('my-ride') // ファイル内に名前がなければ拡張子を除いたファイル名
    expect((await listRoutes(db)).map((r) => r.id)).toEqual([b.id, a.id])
    const loaded = await getRoute(a.id, db)
    expect(loaded?.profile.length).toBe(a.profile.length)
    expect(loaded?.stats).toEqual(a.stats)
  })

  it('解釈できないファイルは保存しない', async () => {
    await expect(addRouteFromFile('x.gpx', new TextEncoder().encode('nope'), db)).rejects.toThrow()
    expect(await listRoutes(db)).toEqual([])
  })

  it('削除できる', async () => {
    const a = await addRouteFromFile('a.gpx', readFixture('route-rtept.gpx'), db)
    await deleteRoute(a.id, db)
    expect(await getRoute(a.id, db)).toBeUndefined()
  })

  it('名前を変えると、そのルートで走った記録の名前もそろう。空の名前は受け付けない', async () => {
    const a = await addRouteFromFile('a.gpx', readFixture('route-rtept.gpx'), db)
    await saveRide({ ...sampleRide(), id: 'r1', routeId: a.id, routeName: a.name }, db)
    await saveRide({ ...sampleRide(), id: 'r2', routeId: 'other', routeName: 'ほか' }, db)
    expect(await renameRoute(a.id, '  ヤビツ峠  ', db)).toBe(true)
    expect((await getRoute(a.id, db))?.name).toBe('ヤビツ峠')
    expect((await getRide('r1', db))?.routeName).toBe('ヤビツ峠')
    expect((await getRide('r2', db))?.routeName).toBe('ほか')
    expect(await renameRoute(a.id, '   ', db)).toBe(false)
    expect((await getRoute(a.id, db))?.name).toBe('ヤビツ峠')
  })
})

describe('settingsRepository', () => {
  it('未保存なら既定値', async () => {
    expect(await loadRiderSettings(db)).toEqual(DEFAULT_RIDER_SETTINGS)
  })

  it('保存した値を読む。欠けた項目は既定値で補う', async () => {
    await saveRiderSettings({ ...DEFAULT_RIDER_SETTINGS, riderMassKg: 58 }, db)
    expect((await loadRiderSettings(db)).riderMassKg).toBe(58)
    await db.settings.put({ key: 'rider', value: { bikeMassKg: 7 } })
    expect(await loadRiderSettings(db)).toEqual({ ...DEFAULT_RIDER_SETTINGS, bikeMassKg: 7 })
  })
})

describe('rideRepository', () => {
  it('走行記録を保存して読み出せる（新しい順）', async () => {
    const a = sampleRide()
    const b = { ...sampleRide(), id: 'ride-2', startedAtMs: a.startedAtMs + 86_400_000 }
    await saveRide(a, db)
    await saveRide(b, db)
    expect((await listRides(db)).map((r) => r.id)).toEqual(['ride-2', 'ride-1'])
    const loaded = await getRide('ride-1', db)
    expect(loaded?.samples).toHaveLength(90)
    expect(loaded?.stats).toEqual(a.stats)
  })
})

describe('referenceRepository', () => {
  it('実走記録をルートとして取り込むと、実走データも保存して紐付ける', async () => {
    const route = await addRouteFromFile('ride.gpx', readFixture('recorded-ride.gpx'), db)
    expect(route.referenceRideId).toBeDefined()
    const ref = await getReference(route.referenceRideId!, db)
    expect(ref?.samples).toHaveLength(3)
    expect(ref?.samples[0]?.heartRateBpm).toBe(150)
    // センサー値はルートには残さない
    expect(route.points[0]).not.toHaveProperty('heartRateBpm')
  })

  it('時刻のないルートは実走データを作らない', async () => {
    const route = await addRouteFromFile('r.gpx', readFixture('track-two-segments.gpx'), db)
    expect(route.referenceRideId).toBeUndefined()
    expect(await listReferences(db)).toEqual([])
  })

  it('実走データだけを取り込める。時刻のないファイルはエラー', async () => {
    const ref = await addReferenceFromFile('last-year.tcx', readFixture('activity.tcx'), db)
    expect(ref.name).toBe('last-year')
    expect(ref.device).toBe('other')
    await expect(
      addReferenceFromFile('route.gpx', readFixture('track-two-segments.gpx'), db),
    ).rejects.toMatchObject({ code: 'notRecorded' })
  })
})
