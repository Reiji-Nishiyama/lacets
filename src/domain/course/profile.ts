import { cumulativeDistancesM, lerp } from './geo.ts'
import { localLinearSmooth, medianFilter } from './smoothing.ts'
import type { CourseStats, ElevationSource, ProfilePoint, RoutePoint } from './types.ts'

export interface ProfileOptions {
  /** 再サンプルの間隔 [m] */
  stepM: number
  /** 中心差分の片側の点数（2〜5） */
  gradeHalfWindow: number
  /** これを超える勾配は物理的にありえないとみなし、近傍から補間する */
  maxAbsGrade: number
}

export const DEFAULT_PROFILE_OPTIONS: ProfileOptions = {
  stepM: 10,
  gradeHalfWindow: 3,
  maxAbsGrade: 0.25,
}

/** 標高の由来ごとの平滑化の強さ [m]（docs/02-architecture.md §6） */
const SMOOTHING_M: Record<ElevationSource, { medianM: number; averageM: number }> = {
  barometric: { medianM: 0, averageM: 30 },
  dem: { medianM: 50, averageM: 100 },
}

export interface SteepSection {
  startM: number
  endM: number
}

export interface CourseProfile {
  profile: ProfilePoint[]
  stats: CourseStats
  /** 元データに標高がなかった（勾配はすべて 0） */
  hasElevation: boolean
  /** ±maxAbsGrade を超えたため補間した区間 */
  steepSections: SteepSection[]
}

/**
 * 取り込んだ点列から走行用の勾配プロファイルを作る。
 * 1. 重複点の除去と累積距離 → 2. 欠けた標高の補間 → 3. 等間隔に再サンプル
 * → 4. 標高の平滑化 → 5. 中心差分で勾配 → 6. ありえない勾配を補間 → 7. 統計
 */
export function buildProfile(
  points: RoutePoint[],
  elevationSource: ElevationSource,
  options: Partial<ProfileOptions> = {},
): CourseProfile {
  const opts = { ...DEFAULT_PROFILE_OPTIONS, ...options }
  const pts = dropDuplicates(points)
  if (pts.length < 2) throw new Error('2 点以上の異なる位置が必要です')
  const dist = cumulativeDistancesM(pts)
  const { elevations, hasElevation } = fillElevations(pts, dist)

  const resampled = resample(pts, dist, elevations, opts.stepM)
  const smoothing = SMOOTHING_M[elevationSource]
  const halfWindow = (m: number) => Math.round(m / (2 * opts.stepM))
  const smoothed = localLinearSmooth(
    medianFilter(
      resampled.map((p) => p.elevationM),
      halfWindow(smoothing.medianM),
    ),
    halfWindow(smoothing.averageM),
  )
  const distances = resampled.map((p) => p.distanceM)
  const rawGrades = centralDifference(distances, smoothed, opts.gradeHalfWindow)
  const { grades, steepSections } = fixImpossibleGrades(distances, rawGrades, opts.maxAbsGrade)

  const profile = resampled.map((p, i) => ({
    ...p,
    elevationM: smoothed[i]!,
    grade: grades[i]!,
  }))
  return { profile, stats: computeStats(profile), hasElevation, steepSections }
}

function dropDuplicates(points: RoutePoint[]): RoutePoint[] {
  return points.filter((p, i) => {
    const prev = points[i - 1]
    return !prev || prev.lat !== p.lat || prev.lon !== p.lon
  })
}

/** 欠けた標高を距離で線形補間し、端は最寄りの値で埋める。標高がまったくなければ 0 */
function fillElevations(
  points: RoutePoint[],
  dist: number[],
): { elevations: number[]; hasElevation: boolean } {
  const known = points.flatMap((p, i) =>
    p.elevationM === undefined ? [] : [{ d: dist[i]!, e: p.elevationM }],
  )
  if (known.length === 0) return { elevations: points.map(() => 0), hasElevation: false }
  let k = 0
  const elevations = points.map((p, i) => {
    if (p.elevationM !== undefined) return p.elevationM
    const d = dist[i]!
    while (k < known.length - 1 && known[k + 1]!.d < d) k++
    const a = known[k]!
    const b = known[k + 1]
    if (d <= a.d || !b) return a.e
    return lerp(a.e, b.e, (d - a.d) / (b.d - a.d))
  })
  return { elevations, hasElevation: true }
}

/** stepM ごとに再サンプルし、終点を必ず含める */
function resample(
  points: RoutePoint[],
  dist: number[],
  elevations: number[],
  stepM: number,
): Omit<ProfilePoint, 'grade'>[] {
  const totalM = dist[dist.length - 1]!
  const targets: number[] = []
  for (let d = 0; d < totalM - stepM * 0.05; d += stepM) targets.push(d)
  targets.push(totalM)

  const out: Omit<ProfilePoint, 'grade'>[] = []
  let seg = 0
  for (const d of targets) {
    while (seg < dist.length - 2 && dist[seg + 1]! < d) seg++
    const d0 = dist[seg]!
    const d1 = dist[seg + 1]!
    const t = d1 > d0 ? Math.min(1, Math.max(0, (d - d0) / (d1 - d0))) : 0
    const a = points[seg]!
    const b = points[seg + 1]!
    out.push({
      distanceM: d,
      lat: lerp(a.lat, b.lat, t),
      lon: lerp(a.lon, b.lon, t),
      elevationM: lerp(elevations[seg]!, elevations[seg + 1]!, t),
    })
  }
  return out
}

/** 中心差分 (e[i+k] − e[i−k]) / (d[i+k] − d[i−k])。端では使える範囲に縮める */
export function centralDifference(distances: number[], elevations: number[], k: number): number[] {
  const n = distances.length
  return distances.map((_, i) => {
    const lo = Math.max(0, i - k)
    const hi = Math.min(n - 1, i + k)
    const dd = distances[hi]! - distances[lo]!
    return dd > 0 ? (elevations[hi]! - elevations[lo]!) / dd : 0
  })
}

/** |grade| > maxAbs の点を、前後の正常な点の勾配から距離で線形補間する */
function fixImpossibleGrades(
  distances: number[],
  grades: number[],
  maxAbs: number,
): { grades: number[]; steepSections: SteepSection[] } {
  const bad = grades.map((g) => Math.abs(g) > maxAbs)
  const steepSections: SteepSection[] = []
  const out = [...grades]
  let i = 0
  while (i < grades.length) {
    if (!bad[i]) {
      i++
      continue
    }
    const start = i
    while (i < grades.length && bad[i]) i++
    const end = i - 1
    steepSections.push({ startM: distances[start]!, endM: distances[end]! })
    const before = start > 0 ? { d: distances[start - 1]!, g: grades[start - 1]! } : undefined
    const after = i < grades.length ? { d: distances[i]!, g: grades[i]! } : undefined
    for (let j = start; j <= end; j++) {
      if (before && after) {
        out[j] = lerp(before.g, after.g, (distances[j]! - before.d) / (after.d - before.d))
      } else {
        const ref = before ?? after
        out[j] = ref ? ref.g : Math.sign(grades[j]!) * maxAbs
      }
    }
  }
  return { grades: out, steepSections }
}

function computeStats(profile: ProfilePoint[]): CourseStats {
  let ascentM = 0
  let descentM = 0
  let maxGrade = -Infinity
  let minGrade = Infinity
  for (let i = 0; i < profile.length; i++) {
    const p = profile[i]!
    const prev = profile[i - 1]
    if (prev) {
      const de = p.elevationM - prev.elevationM
      if (de > 0) ascentM += de
      else descentM -= de
    }
    maxGrade = Math.max(maxGrade, p.grade)
    minGrade = Math.min(minGrade, p.grade)
  }
  return {
    distanceM: profile[profile.length - 1]!.distanceM,
    ascentM,
    descentM,
    maxGrade,
    minGrade,
  }
}
