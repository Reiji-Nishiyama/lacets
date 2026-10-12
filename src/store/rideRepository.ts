import type { RecordedRide } from '../recording/types.ts'
import { db as defaultDb, type LacetsDb } from './db.ts'

export async function saveRide(ride: RecordedRide, db: LacetsDb = defaultDb): Promise<void> {
  await db.rides.put(ride)
}

export function getRide(id: string, db: LacetsDb = defaultDb): Promise<RecordedRide | undefined> {
  return db.rides.get(id)
}

/** 新しい順 */
export function listRides(db: LacetsDb = defaultDb): Promise<RecordedRide[]> {
  return db.rides.orderBy('startedAtMs').reverse().toArray()
}
