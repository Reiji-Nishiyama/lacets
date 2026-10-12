import type { StreetImage } from '../../domain/media/streetImages.ts'

/**
 * Panoramax（フランス発のオープンな路上画像基盤、フェデレーション型）のアダプタ。
 * メタカタログ api.panoramax.xyz は各インスタンスの画像をまとめて検索できる（STAC API, キー不要）。
 * 画像のライセンスはインスタンス・撮影者ごとに異なる（CC-BY-SA-4.0、etalab-2.0 等）ので、画像ごとに表示する。
 */
export const PANORAMAX_API = 'https://api.panoramax.xyz/api'

type Json = Record<string, unknown>

const obj = (v: unknown): Json | undefined =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : undefined
const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined)

/** /api/search の応答（STAC ItemCollection）を共通の形にする。壊れた項目は飛ばす */
export function parsePanoramaxSearch(json: unknown): StreetImage[] {
  const features = obj(json)?.features
  if (!Array.isArray(features)) return []
  return features.flatMap((f): StreetImage[] => {
    const feature = obj(f)
    const id = str(feature?.id)
    const coords = obj(feature?.geometry)?.coordinates
    const props = obj(feature?.properties) ?? {}
    const assets = obj(feature?.assets) ?? {}
    const imageUrl = str(obj(assets.sd)?.href) ?? str(obj(assets.hd)?.href)
    const thumbUrl = str(obj(assets.thumb)?.href) ?? imageUrl
    if (!id || !Array.isArray(coords) || !imageUrl || !thumbUrl) return []
    const [lon, lat] = coords
    if (typeof lat !== 'number' || typeof lon !== 'number') return []
    const azimuth = props['view:azimuth']
    const fov = obj(props['pers:interior_orientation'])?.field_of_view
    const datetime = str(props.datetime)
    const providers = Array.isArray(feature?.providers) ? feature.providers : []
    const producer =
      str(
        obj(providers.find((p) => (obj(p)?.roles as unknown[] | undefined)?.includes('producer')))
          ?.name,
      ) ?? str(props['geovisio:producer'])
    return [
      {
        provider: 'panoramax',
        id,
        lat,
        lon,
        azimuthDeg: typeof azimuth === 'number' ? azimuth : null,
        isPano: fov === 360,
        capturedAtMs: datetime ? Date.parse(datetime) || null : null,
        imageUrl,
        thumbUrl,
        creator: producer ?? null,
        license: str(props.license) ?? null,
      },
    ]
  })
}

/** bbox（minLon, minLat, maxLon, maxLat）内の画像を探す */
export async function searchPanoramax(
  bbox: readonly [number, number, number, number],
  opts: { limit?: number; signal?: AbortSignal; fetchFn?: typeof fetch } = {},
): Promise<StreetImage[]> {
  const fetchFn = opts.fetchFn ?? fetch
  const url = `${PANORAMAX_API}/search?bbox=${bbox.join(',')}&limit=${opts.limit ?? 500}`
  const res = await fetchFn(url, { signal: opts.signal })
  if (!res.ok) throw new Error(`Panoramax の検索に失敗しました（HTTP ${res.status}）`)
  return parsePanoramaxSearch(await res.json())
}
