import { ghostFromRecordedRide } from '../domain/ghost/ghostSources.ts'
import { bestIndex, fullRouteTimeS } from '../domain/ghost/personalBest.ts'
import type { RecordedRide } from '../recording/types.ts'
import type { StoredRoute } from './db.ts'

/**
 * 走行履歴で「自己ベスト」の印を付ける走行。ルート・向きごとに、走り切った記録のうち
 * いちばん速いもの。ルートが削除されていれば（距離が分からないので）印を付けない
 */
export function personalBestRideIds(
  rides: readonly RecordedRide[],
  routes: readonly Pick<StoredRoute, 'id' | 'stats'>[],
): Set<string> {
  const routeM = new Map(routes.map((r) => [r.id, r.stats.distanceM]))
  const groups = new Map<string, RecordedRide[]>()
  for (const ride of rides) {
    if (!routeM.has(ride.routeId)) continue
    const key = `${ride.routeId}:${ride.reversed ? 'reverse' : 'forward'}`
    groups.set(key, [...(groups.get(key) ?? []), ride])
  }
  const ids = new Set<string>()
  for (const group of groups.values()) {
    const m = routeM.get(group[0]!.routeId)!
    const times = group.map((r) =>
      r.samples.length > 0
        ? fullRouteTimeS(ghostFromRecordedRide(r.samples, r.startDistanceM ?? 0), m)
        : null,
    )
    const i = bestIndex(times)
    if (i >= 0) ids.add(group[i]!.id)
  }
  return ids
}
