import { Dexie, type EntityTable } from 'dexie'
import type { ImportedRoute } from '../domain/course/importRoute.ts'

/** 端末内に保存したルート（docs/02-architecture.md §3）。サーバーには置かない */
export interface StoredRoute extends ImportedRoute {
  id: string
  /** 取り込んだファイル名 */
  fileName: string
  createdAt: number
}

export interface SettingRecord {
  key: string
  value: unknown
}

export type LacetsDb = Dexie & {
  routes: EntityTable<StoredRoute, 'id'>
  settings: EntityTable<SettingRecord, 'key'>
}

export function createDb(name = 'lacets'): LacetsDb {
  const db = new Dexie(name) as LacetsDb
  db.version(1).stores({
    routes: 'id, createdAt',
    settings: 'key',
  })
  return db
}

export const db = createDb()
