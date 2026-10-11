import type { RoutePoint } from '../../src/domain/course/types.ts'

/** 緯度 1° あたりの距離 [m]（geo.ts の地球半径に合わせる） */
export const M_PER_DEG_LAT = (6_371_008.8 * Math.PI) / 180

/**
 * (45°N, 6°E) から真北へ伸びる合成ルート。spacingM 間隔で、標高は elevationAt(距離) で与える。
 */
export function northboundRoute(
  lengthM: number,
  spacingM: number,
  elevationAt: (distanceM: number) => number | undefined,
): RoutePoint[] {
  const points: RoutePoint[] = []
  for (let d = 0; d <= lengthM + 1e-9; d += spacingM) {
    points.push({ lat: 45 + d / M_PER_DEG_LAT, lon: 6, elevationM: elevationAt(d) })
  }
  return points
}
