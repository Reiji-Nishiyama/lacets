import { angleDiffDeg } from '../media/streetImages.ts'
import { bearingDeg } from './geo.ts'
import type { ProfilePoint } from './types.ts'

/**
 * 走行中の進み具合を示す「印の列」（docs/07-design.md）。任意のルートにヘアピンがあるとは限らないので、
 * ルートの形と標高から印の種類を選ぶ:
 * - ヘアピンがはっきりある峠（5 つ以上） → ヘアピン 1 つずつ
 * - それ以外の登り → 標高の段（既定 100 m）ごと
 * - 平坦など → 距離の段（既定 1 km）ごと
 */
export type ProgressMarkerKind = 'hairpin' | 'elevation' | 'distance'

export interface ProgressMarkers {
  kind: ProgressMarkerKind
  /** 標高・距離の段の大きさ [m]（ヘアピンは 0） */
  stepM: number
  /** 各印のルート上の距離 [m]（昇順） */
  positionsM: number[]
}

export interface HairpinOptions {
  /** 曲がり角の前後の方位を測る距離 [m] */
  armM: number
  /**
   * これ以上向きが変わったらヘアピンとみなす [deg]。実際のヘアピンは 150〜180°。
   * 10 m ごとの点は角の頂点からずれるので余裕を持たせ、交差点の右左折（90° 前後）とは区別できる値にする
   */
  minTurnDeg: number
  /** これより近い候補は 1 つにまとめる [m] */
  minSpacingM: number
}

export const DEFAULT_HAIRPIN_OPTIONS: HairpinOptions = {
  armM: 40,
  minTurnDeg: 100,
  minSpacingM: 100,
}

/** 印の数の上限（多すぎると列が詰まるので、段を大きくする） */
const MAX_MARKERS = 30
const MIN_HAIRPINS = 5

/**
 * ヘアピン（急な折り返し）の位置を検出する。各点の手前 armM と先 armM の方位の差が minTurnDeg 以上の
 * 区間を探し、近い候補はいちばん大きく曲がる点にまとめる
 */
export function detectHairpins(
  profile: readonly ProfilePoint[],
  options: Partial<HairpinOptions> = {},
): number[] {
  const opts = { ...DEFAULT_HAIRPIN_OPTIONS, ...options }
  if (profile.length < 3) return []
  const step = Math.max(1, profile[1]!.distanceM - profile[0]!.distanceM)
  const k = Math.max(1, Math.round(opts.armM / step))
  const candidates: { distanceM: number; turn: number }[] = []
  for (let i = k; i < profile.length - k; i++) {
    const a = profile[i - k]!
    const p = profile[i]!
    const b = profile[i + k]!
    const turn = angleDiffDeg(
      bearingDeg(a.lat, a.lon, p.lat, p.lon),
      bearingDeg(p.lat, p.lon, b.lat, b.lon),
    )
    if (turn >= opts.minTurnDeg) candidates.push({ distanceM: p.distanceM, turn })
  }
  const out: { distanceM: number; turn: number }[] = []
  for (const c of candidates) {
    const last = out[out.length - 1]
    if (last && c.distanceM - last.distanceM < opts.minSpacingM) {
      if (c.turn > last.turn) out[out.length - 1] = c
    } else {
      out.push(c)
    }
  }
  return out.map((c) => c.distanceM)
}

/** 100, 200, 500, 1000 … のうち、count 個以下になる最小の段 */
function niceStep(total: number, base: number): number {
  for (const mult of [1, 2, 5, 10, 20, 50, 100]) {
    if (total / (base * mult) <= MAX_MARKERS) return base * mult
  }
  return base * 100
}

/** 始点の標高から step ごとの高さに最初に達した地点 */
function elevationMarkers(profile: readonly ProfilePoint[], stepM: number): number[] {
  const start = profile[0]!.elevationM
  const out: number[] = []
  let next = start + stepM
  for (const p of profile) {
    while (p.elevationM >= next) {
      out.push(p.distanceM)
      next += stepM
    }
  }
  return out
}

export function progressMarkers(profile: readonly ProfilePoint[]): ProgressMarkers {
  const hairpins = detectHairpins(profile)
  if (hairpins.length >= MIN_HAIRPINS && hairpins.length <= MAX_MARKERS * 2) {
    return { kind: 'hairpin', stepM: 0, positionsM: hairpins }
  }
  const first = profile[0]!
  const last = profile[profile.length - 1]!
  let peak = first.elevationM
  for (const p of profile) peak = Math.max(peak, p.elevationM)
  // 始点から 150 m 以上登る（逆方向の下りや平坦は距離の印）
  const climbM = peak - first.elevationM
  if (climbM >= 150) {
    const stepM = niceStep(climbM, 100)
    return { kind: 'elevation', stepM, positionsM: elevationMarkers(profile, stepM) }
  }
  const stepM = niceStep(last.distanceM, 1000)
  const positionsM: number[] = []
  for (let d = stepM; d <= last.distanceM; d += stepM) positionsM.push(d)
  return { kind: 'distance', stepM, positionsM }
}

/** 現在地までに越えた印の数 */
export function passedMarkers(markers: ProgressMarkers, distanceM: number): number {
  let n = 0
  for (const d of markers.positionsM) if (d <= distanceM) n++
  return n
}
