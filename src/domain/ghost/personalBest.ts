import type { TimedTrack } from './TimedTrack.ts'

/** スタート・ゴールとみなす範囲 [m]（GPS の誤差や、ゴール判定の手前で終わった記録を許す） */
export const FULL_ROUTE_TOLERANCE_M = 30

/**
 * ルートをスタートからゴールまで走ったときのタイム [s]。途中から走った・途中でやめた記録は
 * タイムを比べられないので null（自己ベストの対象にしない）
 */
export function fullRouteTimeS(track: TimedTrack, routeM: number): number | null {
  if (routeM <= 0 || track.points.length < 2) return null
  if (track.coveredFromM > FULL_ROUTE_TOLERANCE_M) return null
  if (track.coveredToM < routeM - FULL_ROUTE_TOLERANCE_M) return null
  const t0 = track.timeAt(track.coveredFromM)
  const t1 = track.timeAt(Math.min(track.coveredToM, routeM))
  return t0 === null || t1 === null ? null : t1 - t0
}

/** タイムがいちばん短いものの位置。タイムがひとつもなければ -1（同じタイムなら先のもの） */
export function bestIndex(timesS: readonly (number | null)[]): number {
  let best = -1
  for (let i = 0; i < timesS.length; i++) {
    const t = timesS[i]
    if (t === null || t === undefined) continue
    if (best < 0 || t < timesS[best]!) best = i
  }
  return best
}
