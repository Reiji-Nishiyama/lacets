import { DEFAULT_RIDER_SETTINGS, type RiderSettings } from '../domain/rider.ts'
import { DEFAULT_MEDIA_SETTINGS, type MediaSettings } from '../media/mediaSettings.ts'
import { db as defaultDb, type LacetsDb } from './db.ts'

const RIDER_KEY = 'rider'
const MEDIA_KEY = 'media'

/** 保存済みの設定を既定値に重ねて返す（項目が増えても古い保存データで動くように） */
async function load<T extends object>(key: string, defaults: T, db: LacetsDb): Promise<T> {
  const rec = await db.settings.get(key)
  const saved = rec?.value && typeof rec.value === 'object' ? rec.value : {}
  return { ...defaults, ...(saved as Partial<T>) }
}

export function loadRiderSettings(db: LacetsDb = defaultDb): Promise<RiderSettings> {
  return load(RIDER_KEY, DEFAULT_RIDER_SETTINGS, db)
}

export function loadMediaSettings(db: LacetsDb = defaultDb): Promise<MediaSettings> {
  return load(MEDIA_KEY, DEFAULT_MEDIA_SETTINGS, db)
}

export async function saveMediaSettings(
  settings: MediaSettings,
  db: LacetsDb = defaultDb,
): Promise<void> {
  await db.settings.put({ key: MEDIA_KEY, value: settings })
}

export async function saveRiderSettings(
  settings: RiderSettings,
  db: LacetsDb = defaultDb,
): Promise<void> {
  await db.settings.put({ key: RIDER_KEY, value: settings })
}
