import { parseRouteFile } from './parsers/index.ts'
import { buildProfile, type CourseProfile } from './profile.ts'
import type { ElevationSource, RouteFormat, RoutePoint } from './types.ts'

export interface ImportedRoute extends CourseProfile {
  name: string
  format: RouteFormat
  elevationSource: ElevationSource
  points: RoutePoint[]
  startedAtMs?: number
}

/**
 * ルートファイルを解釈し、走行用プロファイルまで作る。
 * 名前がファイル内になければ fallbackName（通常は拡張子を除いたファイル名）を使う。
 */
export function importRoute(bytes: Uint8Array, fallbackName: string): ImportedRoute {
  const parsed = parseRouteFile(bytes)
  return {
    name: parsed.name ?? fallbackName,
    format: parsed.format,
    elevationSource: parsed.elevationSource,
    points: parsed.points,
    startedAtMs: parsed.startedAtMs,
    ...buildProfile(parsed.points, parsed.elevationSource),
  }
}
