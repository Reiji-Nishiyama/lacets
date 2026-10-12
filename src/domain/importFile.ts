import { buildProfile } from './course/profile.ts'
import { parseRouteFile, RouteParseError } from './course/parsers/index.ts'
import type { ParsedRoute } from './course/types.ts'
import type { ImportedRoute } from './course/importRoute.ts'
import { referenceSamplesFrom } from './ghost/ghostSources.ts'
import type { ReferenceRide } from './ghost/types.ts'

export type ImportedReference = Omit<ReferenceRide, 'id' | 'fileName' | 'createdAt'>

function toRoute(parsed: ParsedRoute, fallbackName: string): ImportedRoute {
  return {
    name: parsed.name ?? fallbackName,
    format: parsed.format,
    elevationSource: parsed.elevationSource,
    // センサー値は実走記録（ゴースト）側で持つので、ルートには位置・標高・時刻だけ残す
    points: parsed.points.map(({ lat, lon, elevationM, timeS }) => ({
      lat,
      lon,
      elevationM,
      ...(timeS === undefined ? {} : { timeS }),
    })),
    startedAtMs: parsed.startedAtMs,
    ...buildProfile(parsed.points, parsed.elevationSource),
  }
}

function toReference(parsed: ParsedRoute, fallbackName: string): ImportedReference | null {
  const samples = referenceSamplesFrom(parsed)
  if (!samples || parsed.startedAtMs === undefined) return null
  return {
    name: parsed.name ?? fallbackName,
    recordedAtMs: parsed.startedAtMs,
    device: parsed.device ?? 'other',
    samples,
  }
}

/**
 * ルートとして取り込む。実走記録（時刻付き）なら、ゴースト用の実走データも作る
 * （実走 FIT から作ったルートは、その実走をそのままゴーストにできる: F5-2, F5-3）。
 */
export function importRouteFile(
  bytes: Uint8Array,
  fallbackName: string,
): { route: ImportedRoute; reference: ImportedReference | null } {
  const parsed = parseRouteFile(bytes)
  return { route: toRoute(parsed, fallbackName), reference: toReference(parsed, fallbackName) }
}

/** ゴースト用の実走データだけを取り込む。時刻のないファイル（ルート）はエラー */
export function importReferenceFile(bytes: Uint8Array, fallbackName: string): ImportedReference {
  const reference = toReference(parseRouteFile(bytes), fallbackName)
  if (!reference) throw new RouteParseError('notRecorded', '時刻のない（実走でない）ファイルです')
  return reference
}
