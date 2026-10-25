import type { ProfilePoint } from '../domain/course/types.ts'
import { ghostFromRecordedRide, ghostFromReference } from '../domain/ghost/ghostSources.ts'
import { bestIndex, fullRouteTimeS } from '../domain/ghost/personalBest.ts'
import type { TimedTrack } from '../domain/ghost/TimedTrack.ts'
import type { GhostRef } from '../recording/types.ts'
import type { RouteVariant } from './routeVariant.ts'
import { getReference, listReferences } from './referenceRepository.ts'
import { getRide, listRides } from './rideRepository.ts'

export interface GhostOption {
  ref: GhostRef
  name: string
  recordedAtMs: number
  /** ルートのうちゴーストが走っている割合（0〜1） */
  coverageRatio: number
  /** スタートからゴールまで走った記録ならそのタイム [s]。途中からの記録は null */
  fullTimeS: number | null
  /** 自己ベスト（Lacets の走行の中で）または実走ベスト（実走データの中で） */
  isBest: boolean
}

export interface LoadedGhost {
  ref: GhostRef
  name: string
  track: TimedTrack
  coverageRatio: number
  /** W/kg に使う体重。分からなければ null（ユーザーの体重を使う） */
  riderMassKg: number | null
}

/** この割合未満しか重ならない実走データは、選択肢に出さない */
const MIN_COVERAGE = 0.2

/** 射影は重いので、ルートと実走データの組ごとに覚えておく */
const projectionCache = new Map<string, ReturnType<typeof ghostFromReference>>()

function projectCached(
  variantKey: string,
  profile: readonly ProfilePoint[],
  ref: { id: string; samples: Parameters<typeof ghostFromReference>[1]['samples'] },
) {
  const key = `${variantKey}/${ref.id}`
  let g = projectionCache.get(key)
  if (!g) {
    g = ghostFromReference(profile, ref)
    projectionCache.set(key, g)
  }
  return g
}

/**
 * ルートで使えるゴースト: 同じルート・同じ向きの過去の走行と、ルートに重なる実走データ。
 * 走り切った記録にはタイムを付け、Lacets の走行・実走データそれぞれのいちばん速い記録に
 * 印を付けて先頭に並べる
 */
export async function listGhostOptions(route: RouteVariant): Promise<GhostOption[]> {
  const [rides, refs] = await Promise.all([listRides(), listReferences()])
  const routeM = route.stats.distanceM
  const rideOptions: GhostOption[] = rides
    .filter(
      (r) => r.routeId === route.id && !!r.reversed === route.reversed && r.samples.length > 0,
    )
    .map((r) => ({
      ref: { kind: 'ride', id: r.id },
      name: r.routeName,
      recordedAtMs: r.startedAtMs,
      coverageRatio: Math.min(1, r.stats.distanceM / routeM),
      fullTimeS: fullRouteTimeS(ghostFromRecordedRide(r.samples, r.startDistanceM ?? 0), routeM),
      isBest: false,
    }))
  const refOptions: GhostOption[] = refs.flatMap((ref) => {
    const { coverageRatio, track } = projectCached(route.variantKey, route.profile, ref)
    if (coverageRatio < MIN_COVERAGE) return []
    return [
      {
        ref: { kind: 'reference', id: ref.id },
        name: ref.name,
        recordedAtMs: ref.recordedAtMs,
        coverageRatio,
        fullTimeS: fullRouteTimeS(track, routeM),
        isBest: false,
      },
    ]
  })
  return [...markBest(refOptions), ...markBest(rideOptions)]
}

function markBest(options: GhostOption[]): GhostOption[] {
  const i = bestIndex(options.map((o) => o.fullTimeS))
  if (i < 0) return options
  const best = { ...options[i]!, isBest: true }
  return [best, ...options.filter((_, j) => j !== i)]
}

export async function loadGhost(
  ref: GhostRef,
  route: Pick<RouteVariant, 'variantKey' | 'profile'>,
): Promise<LoadedGhost | null> {
  if (ref.kind === 'ride') {
    const ride = await getRide(ref.id)
    if (!ride) return null
    return {
      ref,
      name: ride.routeName,
      track: ghostFromRecordedRide(ride.samples, ride.startDistanceM ?? 0),
      coverageRatio: 1,
      riderMassKg: ride.settings.riderMassKg,
    }
  }
  const reference = await getReference(ref.id)
  if (!reference) return null
  const g = projectCached(route.variantKey, route.profile, reference)
  return {
    ref,
    name: reference.name,
    track: g.track,
    coverageRatio: g.coverageRatio,
    riderMassKg: null,
  }
}
