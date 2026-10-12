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

function segmentResult(
  track: TimedTrack,
  segment: ReportSegment,
  massKg: number,
): SegmentResult | null {
  const t0 = track.timeAt(segment.startM)
  const t1 = track.timeAt(segment.endM)
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
    const u = segmentResult(user, segment, userMassKg)
    const g = ghost ? segmentResult(ghost, segment, ghostMassKg) : null
    return { segment, user: u, ghost: g, deltaS: u && g ? u.timeS - g.timeS : null }
  })
}
