import type { StreetImage } from '../../domain/media/streetImages.ts'

/**
 * Mapillary API v4 のアダプタ。各自のアクセストークン（クライアントトークン）が必要。
 * bbox は 0.01 度四方より小さくすること（API の制限）。画像は CC BY-SA 4.0。
 */
export const MAPILLARY_API = 'https://graph.mapillary.com'
export const MAPILLARY_LICENSE = 'CC-BY-SA-4.0'

const FIELDS = [
  'id',
  'computed_geometry',
  'geometry',
  'computed_compass_angle',
  'compass_angle',
  'captured_at',
  'thumb_1024_url',
  'thumb_2048_url',
  'creator',
  'is_pano',
].join(',')

type Json = Record<string, unknown>
const obj = (v: unknown): Json | undefined =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : undefined
const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined)
const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined)

export class MapillaryAuthError extends Error {
  override name = 'MapillaryAuthError'
}

/** /images の応答を共通の形にする。壊れた項目は飛ばす */
export function parseMapillaryImages(json: unknown): StreetImage[] {
  const data = obj(json)?.data
  if (!Array.isArray(data)) return []
  return data.flatMap((d): StreetImage[] => {
    const item = obj(d)
    const id = str(item?.id)
    const coords =
      (obj(item?.computed_geometry)?.coordinates as unknown) ??
      (obj(item?.geometry)?.coordinates as unknown)
    const imageUrl = str(item?.thumb_2048_url) ?? str(item?.thumb_1024_url)
    const thumbUrl = str(item?.thumb_1024_url) ?? imageUrl
    if (!id || !Array.isArray(coords) || !imageUrl || !thumbUrl) return []
    const [lon, lat] = coords
    if (typeof lat !== 'number' || typeof lon !== 'number') return []
    const azimuth = num(item?.computed_compass_angle) ?? num(item?.compass_angle)
    return [
      {
        provider: 'mapillary',
        id,
        lat,
        lon,
        azimuthDeg: azimuth ?? null,
        isPano: item?.is_pano === true,
        capturedAtMs: num(item?.captured_at) ?? null,
        imageUrl,
        thumbUrl,
        creator: str(obj(item?.creator)?.username) ?? null,
        license: MAPILLARY_LICENSE,
      },
    ]
  })
}

/** bbox（minLon, minLat, maxLon, maxLat、0.01 度四方未満）内の画像を探す */
export async function searchMapillary(
  bbox: readonly [number, number, number, number],
  accessToken: string,
  opts: { limit?: number; signal?: AbortSignal; fetchFn?: typeof fetch } = {},
): Promise<StreetImage[]> {
  const fetchFn = opts.fetchFn ?? fetch
  const params = new URLSearchParams({
    bbox: bbox.join(','),
    fields: FIELDS,
    limit: String(opts.limit ?? 500),
  })
  // トークンは URL ではなくヘッダで送る（履歴やログに残りにくくする）
  const res = await fetchFn(`${MAPILLARY_API}/images?${params.toString()}`, {
    signal: opts.signal,
    headers: { Authorization: `OAuth ${accessToken}` },
  })
  if (res.status === 401 || res.status === 403) {
    throw new MapillaryAuthError('Mapillary のアクセストークンが正しくありません')
  }
  if (!res.ok) throw new Error(`Mapillary の検索に失敗しました（HTTP ${res.status}）`)
  return parseMapillaryImages(await res.json())
}
