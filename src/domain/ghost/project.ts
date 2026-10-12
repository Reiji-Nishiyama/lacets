import type { ProfilePoint } from '../course/types.ts'

export interface ProjectionOptions {
  /** ルートからこれ以上離れた点は一致しないとみなす [m] */
  maxOffsetM: number
  /** 現在位置から後ろに探す距離 [m] */
  backtrackM: number
  /** 現在位置から前に探す距離 [m] */
  lookaheadM: number
  /** 最初の一致を探すルート先頭からの範囲 [m] */
  initialWindowM: number
  /** これだけ続けて一致しなければ、前方を全域から探す（GPS の欠落や迂回の後） */
  maxMissesBeforeWiden: number
}

export const DEFAULT_PROJECTION: ProjectionOptions = {
  maxOffsetM: 40,
  backtrackM: 100,
  lookaheadM: 2000,
  initialWindowM: 1000,
  maxMissesBeforeWiden: 120,
}

export interface TrackPoint {
  lat: number
  lon: number
  timeS: number
  powerW?: number
}

export interface ProjectedPoint {
  distanceM: number
  timeS: number
  offsetM: number
  powerW?: number
}

export interface ProjectionResult {
  points: ProjectedPoint[]
  /** 最初と最後の一致の間で、一致した点の割合 */
  matchedRatio: number
}

const M_PER_DEG = (6_371_008.8 * Math.PI) / 180

/**
 * 実走の軌跡をルートのポリラインに射影し、各点のルート上の距離を求める（docs/02 §7）。
 * 探索はルート上の現在位置（それまでの最大距離）の前後に限る。これで往復コースの帰り道や、
 * ゴール後に同じ道を下る区間が、ルートの手前の部分に誤って一致しないようにする。
 */
export function projectOntoRoute(
  profile: readonly ProfilePoint[],
  track: readonly TrackPoint[],
  options: Partial<ProjectionOptions> = {},
): ProjectionResult {
  const opts = { ...DEFAULT_PROJECTION, ...options }
  const points: ProjectedPoint[] = []
  let cursorM = 0
  let started = false
  let misses = 0
  let firstMatch = -1
  let lastMatch = -1
  let matchedCount = 0

  for (let i = 0; i < track.length; i++) {
    const p = track[i]!
    const widen = misses >= opts.maxMissesBeforeWiden
    const fromM = started ? cursorM - opts.backtrackM : 0
    const toM = widen ? Infinity : started ? cursorM + opts.lookaheadM : opts.initialWindowM
    const hit = nearestOnRoute(profile, p.lat, p.lon, fromM, toM)
    if (hit && hit.offsetM <= opts.maxOffsetM) {
      started = true
      misses = 0
      cursorM = Math.max(cursorM, hit.distanceM)
      points.push({
        distanceM: hit.distanceM,
        timeS: p.timeS,
        offsetM: hit.offsetM,
        ...(p.powerW === undefined ? {} : { powerW: p.powerW }),
      })
      if (firstMatch < 0) firstMatch = i
      lastMatch = i
      matchedCount++
    } else {
      misses++
    }
  }
  const span = lastMatch - firstMatch + 1
  return { points, matchedRatio: span > 0 ? matchedCount / span : 0 }
}

/** [fromM, toM] の区間のうち、点に最も近いルート上の位置 */
function nearestOnRoute(
  profile: readonly ProfilePoint[],
  lat: number,
  lon: number,
  fromM: number,
  toM: number,
): { distanceM: number; offsetM: number } | null {
  const n = profile.length
  let i = Math.max(0, lowerBound(profile, fromM) - 1)
  let best: { distanceM: number; offsetM: number } | null = null
  const cosLat = Math.cos((lat * Math.PI) / 180)
  for (; i < n - 1; i++) {
    const a = profile[i]!
    if (a.distanceM > toM) break
    const b = profile[i + 1]!
    // 点の周りで局所的に平面とみなす（10 m 程度の区間なら十分な精度）
    const ax = (a.lon - lon) * cosLat * M_PER_DEG
    const ay = (a.lat - lat) * M_PER_DEG
    const bx = (b.lon - lon) * cosLat * M_PER_DEG
    const by = (b.lat - lat) * M_PER_DEG
    const dx = bx - ax
    const dy = by - ay
    const len2 = dx * dx + dy * dy
    const t = len2 > 0 ? Math.min(1, Math.max(0, -(ax * dx + ay * dy) / len2)) : 0
    const offsetM = Math.hypot(ax + t * dx, ay + t * dy)
    if (!best || offsetM < best.offsetM) {
      best = { offsetM, distanceM: a.distanceM + t * (b.distanceM - a.distanceM) }
    }
  }
  return best
}

/** distanceM >= value となる最初のインデックス */
function lowerBound(profile: readonly ProfilePoint[], value: number): number {
  let lo = 0
  let hi = profile.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (profile[mid]!.distanceM < value) lo = mid + 1
    else hi = mid
  }
  return lo
}
