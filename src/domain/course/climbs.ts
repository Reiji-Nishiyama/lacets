import type { ProfilePoint } from './types.ts'

export interface Climb {
  startM: number
  endM: number
  ascentM: number
  averageGrade: number
}

export interface ClimbOptions {
  /** 登りとみなす勾配 */
  minGrade: number
  /** これより短い緩斜面・下りは前後の登りとつなげる [m] */
  maxGapM: number
  /** 登りとして採用する最小の長さ [m] と獲得標高 [m] */
  minLengthM: number
  minAscentM: number
}

export const DEFAULT_CLIMB_OPTIONS: ClimbOptions = {
  minGrade: 0.03,
  maxGapM: 300,
  minLengthM: 500,
  minAscentM: 30,
}

/** 勾配プロファイルから登り区間を自動検出する（ゴースト比較レポートの区間に使う） */
export function detectClimbs(
  profile: readonly ProfilePoint[],
  options: Partial<ClimbOptions> = {},
): Climb[] {
  const opts = { ...DEFAULT_CLIMB_OPTIONS, ...options }
  // 1. 勾配が閾値以上の連続区間（インデックス範囲）
  const runs: [number, number][] = []
  let start = -1
  profile.forEach((p, i) => {
    if (p.grade >= opts.minGrade) {
      if (start < 0) start = i
    } else if (start >= 0) {
      runs.push([start, i - 1])
      start = -1
    }
  })
  if (start >= 0) runs.push([start, profile.length - 1])

  // 2. 短い切れ目でつなぐ
  const merged: [number, number][] = []
  for (const run of runs) {
    const last = merged[merged.length - 1]
    if (last && profile[run[0]]!.distanceM - profile[last[1]]!.distanceM <= opts.maxGapM) {
      last[1] = run[1]
    } else {
      merged.push([...run])
    }
  }

  // 3. 長さと獲得標高で絞る
  return merged.flatMap(([i0, i1]) => {
    const a = profile[i0]!
    const b = profile[i1]!
    const lengthM = b.distanceM - a.distanceM
    const ascentM = b.elevationM - a.elevationM
    if (lengthM < opts.minLengthM || ascentM < opts.minAscentM) return []
    return [{ startM: a.distanceM, endM: b.distanceM, ascentM, averageGrade: ascentM / lengthM }]
  })
}
