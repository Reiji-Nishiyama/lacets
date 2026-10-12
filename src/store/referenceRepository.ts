import type { ReferenceRide } from '../domain/ghost/types.ts'
import { db as defaultDb, type LacetsDb } from './db.ts'

function baseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '') || fileName
}

/** 実走データ（ゴースト用）を取り込んで保存する。時刻のないファイルは RouteParseError */
export async function addReferenceFromFile(
  fileName: string,
  bytes: Uint8Array,
  db: LacetsDb = defaultDb,
): Promise<ReferenceRide> {
  const { importReferenceFile } = await import('../domain/importFile.ts')
  const ref: ReferenceRide = {
    ...importReferenceFile(bytes, baseName(fileName)),
    id: crypto.randomUUID(),
    fileName,
    createdAt: Date.now(),
  }
  await db.referenceRides.add(ref)
  return ref
}

/** 新しい記録順 */
export function listReferences(db: LacetsDb = defaultDb): Promise<ReferenceRide[]> {
  return db.referenceRides.orderBy('recordedAtMs').reverse().toArray()
}

export function getReference(
  id: string,
  db: LacetsDb = defaultDb,
): Promise<ReferenceRide | undefined> {
  return db.referenceRides.get(id)
}

export function deleteReference(id: string, db: LacetsDb = defaultDb): Promise<void> {
  return db.referenceRides.delete(id)
}
