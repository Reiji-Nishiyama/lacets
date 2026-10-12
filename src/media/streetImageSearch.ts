import type { ProfilePoint } from '../domain/course/types.ts'
import {
  searchCellsAlongRoute,
  type StreetImage,
  type StreetImageProvider,
} from '../domain/media/streetImages.ts'
import { MapillaryAuthError, searchMapillary } from '../integrations/mapillary/mapillary.ts'
import { searchPanoramax } from '../integrations/panoramax/panoramax.ts'
import type { MediaSettings } from './mediaSettings.ts'

type Bbox = readonly [number, number, number, number]
export type CellSearcher = (bbox: Bbox, signal?: AbortSignal) => Promise<StreetImage[]>

export interface SearchError {
  provider: StreetImageProvider
  kind: 'auth' | 'network'
  message: string
}

export interface StreetImageSearchResult {
  images: StreetImage[]
  errors: SearchError[]
}

/** 設定から、使うプロバイダーごとの検索関数を作る */
export function searchersFor(
  settings: MediaSettings,
): Partial<Record<StreetImageProvider, CellSearcher>> {
  const out: Partial<Record<StreetImageProvider, CellSearcher>> = {}
  if (settings.panoramaxEnabled) out.panoramax = (bbox, signal) => searchPanoramax(bbox, { signal })
  const token = settings.mapillaryToken.trim()
  if (token) out.mapillary = (bbox, signal) => searchMapillary(bbox, token, { signal })
  return out
}

/**
 * ルートに沿ったマス目ごとに路上画像を検索する。同時実行数を抑え、重複を除く。
 * プロバイダーごとの失敗は errors に入れて他は続ける（認証エラーならそのプロバイダーは打ち切る）
 */
export async function searchStreetImages(
  profile: readonly ProfilePoint[],
  searchers: Partial<Record<StreetImageProvider, CellSearcher>>,
  opts: { signal?: AbortSignal; concurrency?: number } = {},
): Promise<StreetImageSearchResult> {
  const cells = searchCellsAlongRoute(profile)
  const images = new Map<string, StreetImage>()
  const errors: SearchError[] = []

  for (const [provider, search] of Object.entries(searchers) as [
    StreetImageProvider,
    CellSearcher,
  ][]) {
    let failed = 0
    let authFailed = false
    const queue = [...cells]
    const worker = async () => {
      while (queue.length > 0 && !authFailed && !opts.signal?.aborted) {
        const cell = queue.shift()!
        try {
          for (const img of await search(cell, opts.signal))
            images.set(`${img.provider}:${img.id}`, img)
        } catch (e) {
          if (opts.signal?.aborted) return
          if (e instanceof MapillaryAuthError) {
            authFailed = true
            errors.push({ provider, kind: 'auth', message: e.message })
          } else {
            failed++
            console.warn(`${provider} の検索に失敗しました`, e)
          }
        }
      }
    }
    await Promise.all(Array.from({ length: opts.concurrency ?? 4 }, worker))
    if (failed > 0 && !authFailed) {
      errors.push({
        provider,
        kind: 'network',
        message: `${failed} / ${cells.length} 区画の検索に失敗しました`,
      })
    }
  }
  return { images: [...images.values()], errors }
}
