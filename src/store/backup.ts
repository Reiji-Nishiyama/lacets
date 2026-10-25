import { DEFAULT_MEDIA_SETTINGS, type MediaSettings } from '../media/mediaSettings.ts'
import { db as defaultDb, type LacetsDb, type SettingRecord } from './db.ts'

/**
 * 端末の引っ越し用のバックアップ（M6）。ルート・走行記録・実走データ・設定を 1 つのファイルにまとめる。
 * - gzip で圧縮した JSON（走行記録は 1 秒ごとのサンプルを持つので大きくなる）
 * - Mapillary のトークンと MapTiler のキーは入れない（ファイルを人に渡してしまっても漏れないように）
 * - 取り込みは上書きではなく追加。同じ ID のものは置き換える（同じバックアップを 2 回取り込んでも増えない）
 */

const APP = 'lacets'
const KIND = 'backup'
export const BACKUP_VERSION = 1

/** バックアップから外す設定（端末ごとに各自が入れる秘密の値） */
const SECRET_MEDIA_KEYS = [
  'mapillaryToken',
  'maptilerKey',
] as const satisfies readonly (keyof MediaSettings)[]

export interface LacetsBackup {
  app: typeof APP
  kind: typeof KIND
  version: number
  exportedAtMs: number
  routes: unknown[]
  rides: unknown[]
  referenceRides: unknown[]
  settings: SettingRecord[]
}

export interface BackupCounts {
  routes: number
  rides: number
  referenceRides: number
}

export type BackupErrorCode = 'notBackup' | 'newerVersion' | 'broken'

export class BackupFormatError extends Error {
  readonly code: BackupErrorCode
  constructor(code: BackupErrorCode) {
    super(code)
    this.name = 'BackupFormatError'
    this.code = code
  }
}

export async function createBackup(
  db: LacetsDb = defaultDb,
  nowMs = Date.now(),
): Promise<LacetsBackup> {
  const [routes, rides, referenceRides, settings] = await Promise.all([
    db.routes.toArray(),
    db.rides.toArray(),
    db.referenceRides.toArray(),
    db.settings.toArray(),
  ])
  return {
    app: APP,
    kind: KIND,
    version: BACKUP_VERSION,
    exportedAtMs: nowMs,
    routes,
    rides,
    referenceRides,
    settings: settings.map(withoutSecrets),
  }
}

function withoutSecrets(rec: SettingRecord): SettingRecord {
  if (rec.key !== 'media' || !rec.value || typeof rec.value !== 'object') return rec
  const value = { ...(rec.value as Record<string, unknown>) }
  for (const k of SECRET_MEDIA_KEYS) delete value[k]
  return { key: rec.key, value }
}

export async function restoreBackup(
  backup: LacetsBackup,
  db: LacetsDb = defaultDb,
): Promise<BackupCounts> {
  await db.transaction('rw', [db.routes, db.rides, db.referenceRides, db.settings], async () => {
    await db.routes.bulkPut(backup.routes as never[])
    await db.rides.bulkPut(backup.rides as never[])
    await db.referenceRides.bulkPut(backup.referenceRides as never[])
    for (const rec of backup.settings) {
      if (rec.key !== 'media') {
        await db.settings.put(rec)
        continue
      }
      // この端末のトークン・キーは残す
      const current = (await db.settings.get('media'))?.value as Partial<MediaSettings> | undefined
      const secrets = Object.fromEntries(
        SECRET_MEDIA_KEYS.map((k) => [k, current?.[k] ?? DEFAULT_MEDIA_SETTINGS[k]]),
      )
      await db.settings.put({ key: 'media', value: { ...(rec.value as object), ...secrets } })
    }
  })
  return {
    routes: backup.routes.length,
    rides: backup.rides.length,
    referenceRides: backup.referenceRides.length,
  }
}

export async function encodeBackup(backup: LacetsBackup): Promise<Uint8Array> {
  const json = new TextEncoder().encode(JSON.stringify(backup))
  return gzip(json)
}

/** gzip でも素の JSON でも読む（中身を確かめたいときに展開したファイルも受け付ける） */
export async function decodeBackup(bytes: Uint8Array): Promise<LacetsBackup> {
  let text: string
  try {
    const raw = bytes[0] === 0x1f && bytes[1] === 0x8b ? await gunzip(bytes) : bytes
    text = new TextDecoder().decode(raw)
  } catch {
    throw new BackupFormatError('broken')
  }
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new BackupFormatError('notBackup')
  }
  if (!isRecord(data) || data.app !== APP || data.kind !== KIND) {
    throw new BackupFormatError('notBackup')
  }
  if (typeof data.version !== 'number' || data.version > BACKUP_VERSION) {
    throw new BackupFormatError('newerVersion')
  }
  for (const k of ['routes', 'rides', 'referenceRides', 'settings'] as const) {
    if (!Array.isArray(data[k])) throw new BackupFormatError('broken')
  }
  return data as unknown as LacetsBackup
}

/** 「lacets-backup-20261025.json.gz」 */
export function backupFileName(nowMs: number): string {
  const d = new Date(nowMs)
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  return `lacets-backup-${ymd}.json.gz`
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  return pipe(bytes, new CompressionStream('gzip'))
}

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  return pipe(bytes, new DecompressionStream('gzip'))
}

async function pipe(
  bytes: Uint8Array,
  transform: CompressionStream | DecompressionStream,
): Promise<Uint8Array> {
  const stream = new Blob([new Uint8Array(bytes)]).stream().pipeThrough(transform)
  return new Uint8Array(await new Response(stream).arrayBuffer())
}
