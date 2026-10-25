import { db as defaultDb, type LacetsDb, type StoredRoute } from './db.ts'

function baseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '') || fileName
}

/**
 * ルートファイルを解釈して保存する。実走記録なら実走データ（ゴースト用）も保存して紐付ける。
 * 解釈できなければ RouteParseError を投げる
 */
export async function addRouteFromFile(
  fileName: string,
  bytes: Uint8Array,
  db: LacetsDb = defaultDb,
): Promise<StoredRoute> {
  // パーサ（FIT SDK を含む）は大きいので、取り込むときだけ読み込む
  const { importRouteFile } = await import('../domain/importFile.ts')
  const { route: imported, reference } = importRouteFile(bytes, baseName(fileName))
  const createdAt = Date.now()
  const referenceRideId = reference ? crypto.randomUUID() : undefined
  const route: StoredRoute = {
    ...imported,
    id: crypto.randomUUID(),
    fileName,
    createdAt,
    ...(referenceRideId ? { referenceRideId } : {}),
  }
  await db.transaction('rw', db.routes, db.referenceRides, async () => {
    await db.routes.add(route)
    if (reference && referenceRideId) {
      await db.referenceRides.add({ ...reference, id: referenceRideId, fileName, createdAt })
    }
  })
  return route
}

/** 新しい順 */
export function listRoutes(db: LacetsDb = defaultDb): Promise<StoredRoute[]> {
  return db.routes.orderBy('createdAt').reverse().toArray()
}

export function getRoute(id: string, db: LacetsDb = defaultDb): Promise<StoredRoute | undefined> {
  return db.routes.get(id)
}

export function deleteRoute(id: string, db: LacetsDb = defaultDb): Promise<void> {
  return db.routes.delete(id)
}

/**
 * ルート名を変える。このルートで走った記録の名前（履歴・ゴーストの一覧に出る）もそろえる。
 * 空白だけの名前は受け付けない（false を返す）
 */
export async function renameRoute(
  id: string,
  name: string,
  db: LacetsDb = defaultDb,
): Promise<boolean> {
  const trimmed = name.trim()
  if (!trimmed) return false
  await db.transaction('rw', db.routes, db.rides, async () => {
    await db.routes.update(id, { name: trimmed })
    await db.rides.where('routeId').equals(id).modify({ routeName: trimmed })
  })
  return true
}
