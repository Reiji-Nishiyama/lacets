import { create } from 'zustand'
import { Course } from '../domain/course/Course.ts'
import {
  imageCoverage,
  indexImagesAlongRoute,
  type RouteImage,
  type StreetImageProvider,
} from '../domain/media/streetImages.ts'
import type { MediaSettings } from '../media/mediaSettings.ts'
import { searchersFor, searchStreetImages, type SearchError } from '../media/streetImageSearch.ts'
import type { StoredRoute } from './db.ts'

export interface RouteImageIndex {
  status: 'loading' | 'ready'
  index: RouteImage[]
  /** ルートのうち路上画像を表示できる割合 */
  coverageRatio: number
  counts: Partial<Record<StreetImageProvider, number>>
  errors: SearchError[]
}

interface StreetImageState {
  /** キーは routeId と使うプロバイダー（設定が変われば検索し直す） */
  byKey: Record<string, RouteImageIndex>
}

export const useStreetImageStore = create<StreetImageState>(() => ({ byKey: {} }))

/** 端末には保存せず、このセッションの間だけ覚えておく */
const pending = new Map<string, AbortController>()

export function streetImageKey(routeId: string, settings: MediaSettings): string {
  const providers = Object.keys(searchersFor(settings)).sort().join('+')
  return `${routeId}/${providers}/${settings.mapillaryToken.trim().length > 0 ? 'm' : ''}`
}

/** ルートの路上画像の索引を用意する（検索済み・検索中なら何もしない） */
export function ensureStreetImages(route: StoredRoute, settings: MediaSettings): string {
  const key = streetImageKey(route.id, settings)
  if (useStreetImageStore.getState().byKey[key] || pending.has(key)) return key
  const searchers = searchersFor(settings)
  const empty: RouteImageIndex = {
    status: 'ready',
    index: [],
    coverageRatio: 0,
    counts: {},
    errors: [],
  }
  if (Object.keys(searchers).length === 0) {
    setIndex(key, empty)
    return key
  }
  setIndex(key, { ...empty, status: 'loading' })
  const controller = new AbortController()
  pending.set(key, controller)
  void (async () => {
    try {
      const { images, errors } = await searchStreetImages(route.profile, searchers, {
        signal: controller.signal,
      })
      const course = new Course(route.profile)
      // カメラの向きと比べる進行方向は、少し先までの区間の方位で滑らかにする
      const index = indexImagesAlongRoute(route.profile, images, (d) =>
        course.headingBetween(d, d + 30),
      )
      const counts: RouteImageIndex['counts'] = {}
      for (const r of index) counts[r.image.provider] = (counts[r.image.provider] ?? 0) + 1
      setIndex(key, {
        status: 'ready',
        index,
        coverageRatio: imageCoverage(index, route.stats.distanceM, { nowMs: Date.now() }),
        counts,
        errors,
      })
    } catch (e) {
      console.warn('路上画像を検索できませんでした', e)
      setIndex(key, empty)
    } finally {
      pending.delete(key)
    }
  })()
  return key
}

function setIndex(key: string, value: RouteImageIndex) {
  useStreetImageStore.setState((s) => ({ byKey: { ...s.byKey, [key]: value } }))
}
