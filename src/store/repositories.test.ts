import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFixture } from '../../test/helpers/fixtures.ts'
import { DEFAULT_RIDER_SETTINGS } from '../domain/rider.ts'
import { createDb, type LacetsDb } from './db.ts'
import { addRouteFromFile, deleteRoute, getRoute, listRoutes } from './routeRepository.ts'
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
