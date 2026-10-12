import type { ParsedRoute, ProfilePoint } from '../course/types.ts'
import { projectOntoRoute, type ProjectionOptions } from './project.ts'
import { TimedTrack } from './TimedTrack.ts'
import type { ReferenceRide, ReferenceSample } from './types.ts'

/** 解釈したファイルが実走記録（全点に時刻がある）なら、ゴースト用のサンプルにする */
export function referenceSamplesFrom(parsed: ParsedRoute): ReferenceSample[] | null {
  if (parsed.startedAtMs === undefined) return null
  if (!parsed.points.every((p) => p.timeS !== undefined)) return null
  return parsed.points.map((p) => ({
    timeS: p.timeS!,
    lat: p.lat,
    lon: p.lon,
    ...(p.elevationM === undefined ? {} : { elevationM: p.elevationM }),
    ...(p.powerW === undefined ? {} : { powerW: p.powerW }),
    ...(p.heartRateBpm === undefined ? {} : { heartRateBpm: p.heartRateBpm }),
    ...(p.cadenceRpm === undefined ? {} : { cadenceRpm: p.cadenceRpm }),
  }))
}

export interface ReferenceGhost {
  track: TimedTrack
  /** ルート全長のうちゴーストが走っている割合 */
  coverageRatio: number
  /** 一致した点の割合（低ければ別のルートの記録の可能性） */
  matchedRatio: number
}

/** 実走記録をルートに射影してゴーストにする */
export function ghostFromReference(
  profile: readonly ProfilePoint[],
  ref: Pick<ReferenceRide, 'samples'>,
  options?: Partial<ProjectionOptions>,
): ReferenceGhost {
  const { points, matchedRatio } = projectOntoRoute(profile, ref.samples, options)
  const track = TimedTrack.fromSamples(points)
  const routeM = profile[profile.length - 1]?.distanceM ?? 0
  const coverageRatio =
    routeM > 0 && points.length > 1 ? (track.coveredToM - track.coveredFromM) / routeM : 0
  return { track, coverageRatio, matchedRatio }
}

/** Lacets で記録した走行（同じルートの距離軸）をゴーストにする */
export function ghostFromRecordedRide(
  samples: readonly { distanceM: number; elapsedS: number; powerW: number }[],
): TimedTrack {
  // 走行時間（一時停止を除く）は静止状態の 0 秒から始まるので、待機の除外はしない
  return TimedTrack.fromSamples(
    [
      { distanceM: 0, timeS: 0 },
      ...samples.map((s) => ({ distanceM: s.distanceM, timeS: s.elapsedS, powerW: s.powerW })),
    ],
    0,
  )
}
