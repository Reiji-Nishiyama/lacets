import { buildProfile, type CourseProfile } from './profile.ts'
import type { ElevationSource, RoutePoint } from './types.ts'

/**
 * ルートを逆方向に走るためのプロファイル（#6）。元の点列を反転して作り直す
 * （勾配の符号・距離・獲得標高と下りが自然に入れ替わる）。時刻は意味を持たなくなるので落とす
 */
export function reversedProfile(
  points: readonly RoutePoint[],
  elevationSource: ElevationSource,
): CourseProfile {
  const reversed = [...points]
    .reverse()
    .map(({ lat, lon, elevationM }) => ({ lat, lon, elevationM }))
  return buildProfile(reversed, elevationSource)
}
