import type { RoutePoint } from '../types.ts'

/** 絶対時刻（Unix ms）を最初の時刻付きの点からの経過秒数に変換する。 */
export function toElapsed(points: (Omit<RoutePoint, 'timeS'> & { timeMs?: number })[]): {
  points: RoutePoint[]
  startedAtMs?: number
} {
  const startedAtMs = points.find((p) => p.timeMs !== undefined)?.timeMs
  return {
    startedAtMs,
    points: points.map(({ timeMs, ...p }) =>
      timeMs !== undefined && startedAtMs !== undefined
        ? { ...p, timeS: (timeMs - startedAtMs) / 1000 }
        : p,
    ),
  }
}

export function parseIsoTimeMs(value: string | undefined): number | undefined {
  if (!value) return undefined
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : undefined
}
