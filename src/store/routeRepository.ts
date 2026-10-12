import { db as defaultDb, type LacetsDb, type StoredRoute } from './db.ts'

function baseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '') || fileName
}

/** ルートファイルを解釈して保存する。解釈できなければ RouteParseError を投げる */
export async function addRouteFromFile(
  fileName: string,
  bytes: Uint8Array,
  db: LacetsDb = defaultDb,
): Promise<StoredRoute> {
  // パーサ（FIT SDK を含む）は大きいので、取り込むときだけ読み込む
  const { importRoute } = await import('../domain/course/importRoute.ts')
  const route: StoredRoute = {
    ...importRoute(bytes, baseName(fileName)),
    id: crypto.randomUUID(),
    fileName,
    createdAt: Date.now(),
  }
  await db.routes.add(route)
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
