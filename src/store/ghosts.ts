import type { ProfilePoint } from '../domain/course/types.ts'
import { ghostFromRecordedRide, ghostFromReference } from '../domain/ghost/ghostSources.ts'
import type { TimedTrack } from '../domain/ghost/TimedTrack.ts'
import type { GhostRef } from '../recording/types.ts'
import type { StoredRoute } from './db.ts'
import { getReference, listReferences } from './referenceRepository.ts'
import { getRide, listRides } from './rideRepository.ts'

export interface GhostOption {
  ref: GhostRef
  name: string
  recordedAtMs: number
  /** ルートのうちゴーストが走っている割合（0〜1） */
  coverageRatio: number
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
  routeId: string,
  profile: readonly ProfilePoint[],
  ref: { id: string; samples: Parameters<typeof ghostFromReference>[1]['samples'] },
) {
  const key = `${routeId}/${ref.id}`
  let g = projectionCache.get(key)
  if (!g) {
    g = ghostFromReference(profile, ref)
    projectionCache.set(key, g)
  }
  return g
}

/** ルートで使えるゴースト: 同じルートの過去の走行と、ルートに重なる実走データ */
export async function listGhostOptions(route: StoredRoute): Promise<GhostOption[]> {
  const [rides, refs] = await Promise.all([listRides(), listReferences()])
  const rideOptions: GhostOption[] = rides
    .filter((r) => r.routeId === route.id && r.samples.length > 0)
    .map((r) => ({
      ref: { kind: 'ride', id: r.id },
      name: r.routeName,
      recordedAtMs: r.startedAtMs,
      coverageRatio: Math.min(1, r.stats.distanceM / route.stats.distanceM),
    }))
  const refOptions: GhostOption[] = refs.flatMap((ref) => {
    const { coverageRatio } = projectCached(route.id, route.profile, ref)
    if (coverageRatio < MIN_COVERAGE) return []
    return [
      {
        ref: { kind: 'reference', id: ref.id },
        name: ref.name,
        recordedAtMs: ref.recordedAtMs,
        coverageRatio,
      },
    ]
  })
  return [...refOptions, ...rideOptions]
}

export async function loadGhost(
  ref: GhostRef,
  route: Pick<StoredRoute, 'id' | 'profile'>,
): Promise<LoadedGhost | null> {
  if (ref.kind === 'ride') {
    const ride = await getRide(ref.id)
    if (!ride) return null
    return {
      ref,
      name: ride.routeName,
      track: ghostFromRecordedRide(ride.samples),
      coverageRatio: 1,
      riderMassKg: ride.settings.riderMassKg,
    }
  }
  const reference = await getReference(ref.id)
  if (!reference) return null
  const g = projectCached(route.id, route.profile, reference)
  return {
    ref,
    name: reference.name,
    track: g.track,
    coverageRatio: g.coverageRatio,
    riderMassKg: null,
  }
}
