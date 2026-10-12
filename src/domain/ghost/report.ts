import type { Climb } from '../course/climbs.ts'
import type { TimedTrack } from './TimedTrack.ts'

export interface ReportSegment {
  kind: 'km' | 'climb'
  startM: number
  endM: number
  /** 登りの場合の平均勾配 */
  averageGrade?: number
}

export interface SegmentResult {
  timeS: number
  averagePowerW: number | null
  wattsPerKg: number | null
}

export interface SegmentComparison {
  segment: ReportSegment
  user: SegmentResult | null
  ghost: SegmentResult | null
  /** user − ghost [s]。負ならゴーストより速い */
  deltaS: number | null
}

/** 1 km ごとの区間（最後は端数） */
export function kilometerSegments(totalM: number, stepM = 1000): ReportSegment[] {
  const out: ReportSegment[] = []
  for (let d = 0; d < totalM - 1; d += stepM) {
    out.push({ kind: 'km', startM: d, endM: Math.min(totalM, d + stepM) })
  }
  return out
}

export function climbSegments(climbs: readonly Climb[]): ReportSegment[] {
  return climbs.map((c) => ({
    kind: 'climb',
    startM: c.startM,
    endM: c.endM,
    averageGrade: c.averageGrade,
  }))
}

/**
 * ゴーストの範囲の端がこの距離以内なら、区間をゴーストの範囲に縮めて比べる [m]。
 * 実走ゴーストはスタート地点の待機を除くため、ルートの 0 m より少し先から始まる
 */
const EDGE_TOLERANCE_M = 100

/** 自分とゴーストを比べる距離の範囲。ゴーストが区間を覆っていなければ null */
function comparableRange(
  segment: ReportSegment,
  ghost: TimedTrack | null,
): { startM: number; endM: number } | null {
  if (!ghost) return { startM: segment.startM, endM: segment.endM }
  const startM =
    ghost.coveredFromM > segment.startM && ghost.coveredFromM - segment.startM <= EDGE_TOLERANCE_M
      ? ghost.coveredFromM
      : segment.startM
  const endM =
    ghost.coveredToM < segment.endM && segment.endM - ghost.coveredToM <= EDGE_TOLERANCE_M
      ? ghost.coveredToM
      : segment.endM
  return endM > startM ? { startM, endM } : null
}

function segmentResult(
  track: TimedTrack,
  range: { startM: number; endM: number },
  massKg: number,
): SegmentResult | null {
  const t0 = track.timeAt(range.startM)
  const t1 = track.timeAt(range.endM)
  if (t0 === null || t1 === null) return null
  const averagePowerW = track.averagePowerBetween(t0, t1)
  return {
    timeS: t1 - t0,
    averagePowerW,
    wattsPerKg: averagePowerW === null || massKg <= 0 ? null : averagePowerW / massKg,
  }
}

/**
 * 区間ごとにタイム・平均パワー・W/kg を比べる（F5-4）。主指標はパワー（F5-5）。
 * W/kg は各自の体重で割る（ゴーストの体重が分からなければユーザーと同じ体重を使う）。
 */
export function compareSegments(
  segments: readonly ReportSegment[],
  user: TimedTrack,
  ghost: TimedTrack | null,
  userMassKg: number,
  ghostMassKg = userMassKg,
): SegmentComparison[] {
  return segments.map((segment) => {
    const range = comparableRange(segment, ghost)
    const g = ghost && range ? segmentResult(ghost, range, ghostMassKg) : null
    // ゴーストと比べられる区間は同じ範囲で、比べられなければ区間全体で自分の値を出す
    const u = segmentResult(user, g && range ? range : segment, userMassKg)
    return { segment, user: u, ghost: g, deltaS: u && g ? u.timeS - g.timeS : null }
  })
}
