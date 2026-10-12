import { detectClimbs } from '../domain/course/climbs.ts'
import { ghostFromRecordedRide } from '../domain/ghost/ghostSources.ts'
import {
  climbSegments,
  compareSegments,
  kilometerSegments,
  type SegmentComparison,
} from '../domain/ghost/report.ts'
import type { RecordedRide } from '../recording/types.ts'
import { loadGhost } from './ghosts.ts'
import { getRoute } from './routeRepository.ts'
import { routeVariant } from './routeVariant.ts'

export interface RideReport {
  kilometers: SegmentComparison[]
  climbs: SegmentComparison[]
  /** 比べたゴーストの名前。ゴーストなし・読めなかった場合は null */
  ghostName: string | null
}

/** 走行後の区間比較レポートを作る（F5-4）。ルートが削除されていれば 1 km ごとだけ */
export async function buildRideReport(ride: RecordedRide): Promise<RideReport> {
  const stored = await getRoute(ride.routeId)
  const route = stored ? routeVariant(stored, !!ride.reversed) : null
  const startM = ride.startDistanceM ?? 0
  const user = ghostFromRecordedRide(ride.samples, startM)
  const ghost = ride.ghost && route ? await loadGhost(ride.ghost, route) : null
  const userMassKg = ride.settings.riderMassKg
  const ghostMassKg = ghost?.riderMassKg ?? userMassKg
  const endM = startM + ride.stats.distanceM
  // 走った範囲に収まる登りだけ
  const climbs = route
    ? climbSegments(detectClimbs(route.profile)).filter(
        (c) => c.startM >= startM - 1 && c.endM <= endM + 1,
      )
    : []
  return {
    kilometers: compareSegments(
      kilometerSegments(startM, endM),
      user,
      ghost?.track ?? null,
      userMassKg,
      ghostMassKg,
    ),
    climbs: compareSegments(climbs, user, ghost?.track ?? null, userMassKg, ghostMassKg),
    ghostName: ghost?.name ?? null,
  }
}
