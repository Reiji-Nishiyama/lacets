import { DEFAULT_RIDER_SETTINGS, type RiderSettings } from '../domain/rider.ts'
import { db as defaultDb, type LacetsDb } from './db.ts'

const RIDER_KEY = 'rider'

/** 保存済みの設定を既定値に重ねて返す（項目が増えても古い保存データで動くように） */
export async function loadRiderSettings(db: LacetsDb = defaultDb): Promise<RiderSettings> {
  const rec = await db.settings.get(RIDER_KEY)
  const saved = rec?.value && typeof rec.value === 'object' ? rec.value : {}
  return { ...DEFAULT_RIDER_SETTINGS, ...(saved as Partial<RiderSettings>) }
}

export async function saveRiderSettings(
  settings: RiderSettings,
  db: LacetsDb = defaultDb,
): Promise<void> {
  await db.settings.put({ key: RIDER_KEY, value: settings })
}
