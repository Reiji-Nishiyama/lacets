import { reversedProfile } from '../domain/course/reverse.ts'
import type { StoredRoute } from './db.ts'

/**
 * 走る向きを決めたルート（#6）。逆方向ならプロファイル・統計を作り直したもの。
 * ゴースト・レポート・路上画像のキャッシュは variantKey で分ける（向きで距離軸が変わるため）
 */
export interface RouteVariant extends StoredRoute {
  reversed: boolean
  variantKey: string
}

const cache = new Map<string, RouteVariant>()

export function routeVariant(route: StoredRoute, reversed: boolean): RouteVariant {
  const variantKey = reversed ? `${route.id}:reverse` : route.id
  if (!reversed) return { ...route, reversed, variantKey }
  // ルートは取り込み後に変わらないので、ID と取り込み時刻で覚えておく
  const cacheKey = `${variantKey}/${route.createdAt}`
  let v = cache.get(cacheKey)
  if (!v) {
    v = {
      ...route,
      ...reversedProfile(route.points, route.elevationSource),
      reversed,
      variantKey,
    }
    cache.set(cacheKey, v)
  }
  return v
}
