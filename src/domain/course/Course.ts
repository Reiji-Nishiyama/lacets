import { bearingDeg, lerp } from './geo.ts'
import type { ProfilePoint } from './types.ts'

export interface CoursePosition {
  distanceM: number
  lat: number
  lon: number
  elevationM: number
  grade: number
  /** 進行方向 [deg]（北 = 0、時計回り） */
  headingDeg: number
}

/**
 * 勾配プロファイルを距離で引く。走行ループ（4 Hz）から呼ぶため二分探索で O(log n)。
 * 範囲外の距離は始点・終点にクランプする。
 */
export class Course {
  readonly profile: readonly ProfilePoint[]
  readonly distanceM: number

  constructor(profile: readonly ProfilePoint[]) {
    if (profile.length < 2) throw new Error('プロファイルには 2 点以上が必要です')
    this.profile = profile
    this.distanceM = profile[profile.length - 1]!.distanceM
  }

  gradeAt(distanceM: number): number {
    const { a, b, t } = this.segment(distanceM)
    return lerp(a.grade, b.grade, t)
  }

  positionAt(distanceM: number): CoursePosition {
    const { a, b, t } = this.segment(distanceM)
    return {
      distanceM: Math.min(this.distanceM, Math.max(0, distanceM)),
      lat: lerp(a.lat, b.lat, t),
      lon: lerp(a.lon, b.lon, t),
      elevationM: lerp(a.elevationM, b.elevationM, t),
      grade: lerp(a.grade, b.grade, t),
      headingDeg: bearingDeg(a.lat, a.lon, b.lat, b.lon),
    }
  }

  /** distanceM を含む区間 [a, b] と区間内の位置 t（0〜1） */
  private segment(distanceM: number): { a: ProfilePoint; b: ProfilePoint; t: number } {
    const p = this.profile
    const d = Math.min(this.distanceM, Math.max(0, distanceM))
    let lo = 0
    let hi = p.length - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (p[mid]!.distanceM <= d) lo = mid
      else hi = mid
    }
    const a = p[lo]!
    const b = p[hi]!
    const span = b.distanceM - a.distanceM
    return { a, b, t: span > 0 ? (d - a.distanceM) / span : 0 }
  }
}
