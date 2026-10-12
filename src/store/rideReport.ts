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

export interface RideReport {
  kilometers: SegmentComparison[]
  climbs: SegmentComparison[]
  /** 比べたゴーストの名前。ゴーストなし・読めなかった場合は null */
  ghostName: string | null
}

/** 走行後の区間比較レポートを作る（F5-4）。ルートが削除されていれば 1 km ごとだけ */
export async function buildRideReport(ride: RecordedRide): Promise<RideReport> {
  const route = await getRoute(ride.routeId)
  const user = ghostFromRecordedRide(ride.samples)
  const ghost = ride.ghost && route ? await loadGhost(ride.ghost, route) : null
  const userMassKg = ride.settings.riderMassKg
  const ghostMassKg = ghost?.riderMassKg ?? userMassKg
  const ridden = ride.stats.distanceM
  const climbs = route
    ? climbSegments(detectClimbs(route.profile)).filter((c) => c.endM <= ridden + 1)
    : []
  return {
    kilometers: compareSegments(
      kilometerSegments(ridden),
      user,
      ghost?.track ?? null,
      userMassKg,
      ghostMassKg,
    ),
    climbs: compareSegments(climbs, user, ghost?.track ?? null, userMassKg, ghostMassKg),
    ghostName: ghost?.name ?? null,
  }
}
