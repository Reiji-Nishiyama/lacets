import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFixture } from '../../test/helpers/fixtures.ts'
import { sampleRide } from '../../test/helpers/recordedRide.ts'
import {
  backupFileName,
  BackupFormatError,
  createBackup,
  decodeBackup,
  encodeBackup,
  restoreBackup,
} from './backup.ts'
import { createDb, type LacetsDb } from './db.ts'
import { saveRide } from './rideRepository.ts'
import { addRouteFromFile, listRoutes } from './routeRepository.ts'
import { loadMediaSettings, saveMediaSettings } from './settingsRepository.ts'

let from: LacetsDb
let to: LacetsDb

beforeEach(() => {
  from = createDb(`from-${crypto.randomUUID()}`)
  to = createDb(`to-${crypto.randomUUID()}`)
})

afterEach(async () => {
  await from.delete()
  await to.delete()
})

describe('backup', () => {
  it('ルート・走行・設定を別の端末へ移せる。トークンとキーは移さず、移し先のものを残す', async () => {
    const route = await addRouteFromFile(
      'track-two-segments.gpx',
      readFixture('track-two-segments.gpx'),
      from,
    )
    await saveRide(sampleRide(), from)
    await saveMediaSettings(
      { panoramaxEnabled: false, mapillaryToken: 'MLY|secret', maptilerKey: 'key' },
      from,
    )
    await saveMediaSettings(
      { panoramaxEnabled: true, mapillaryToken: 'MLY|mine', maptilerKey: '' },
      to,
    )

    const bytes = await encodeBackup(await createBackup(from))
    expect(new TextDecoder().decode(bytes)).not.toContain('secret') // 圧縮されている
    const backup = await decodeBackup(bytes)
    expect(JSON.stringify(backup)).not.toContain('MLY|secret')

    const counts = await restoreBackup(backup, to)
    expect(counts).toEqual({ routes: 1, rides: 1, referenceRides: 0 })
    expect((await listRoutes(to)).map((r) => r.id)).toEqual([route.id])
    expect(await to.rides.count()).toBe(1)
    expect(await loadMediaSettings(to)).toEqual({
      panoramaxEnabled: false,
      mapillaryToken: 'MLY|mine',
      maptilerKey: '',
    })

    // 同じバックアップをもう一度取り込んでも増えない
    await restoreBackup(backup, to)
    expect(await to.routes.count()).toBe(1)
  })

  it('バックアップでないファイル・新しい形式は取り込まない', async () => {
    const enc = (v: unknown) => new TextEncoder().encode(JSON.stringify(v))
    await expect(decodeBackup(enc({ hello: 1 }))).rejects.toThrow(BackupFormatError)
    await expect(decodeBackup(new TextEncoder().encode('<gpx/>'))).rejects.toMatchObject({
      code: 'notBackup',
    })
    const newer = { ...(await createBackup(from)), version: 99 }
    await expect(decodeBackup(enc(newer))).rejects.toMatchObject({ code: 'newerVersion' })
  })

  it('ファイル名は日付入り', () => {
    expect(backupFileName(new Date(2026, 9, 25, 12).getTime())).toBe(
      'lacets-backup-20261025.json.gz',
    )
  })
})
