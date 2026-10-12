import { DEFAULT_RIDER_SETTINGS } from '../../src/domain/rider.ts'
import { computeRideStats } from '../../src/recording/rideStats.ts'
import type { RecordedRide, RideSample } from '../../src/recording/types.ts'

export const T0 = Date.parse('2026-10-12T09:30:00Z')

/** 60 秒走って 30 秒休み、さらに 30 秒走ったテスト用の記録 */
export function sampleRide(): RecordedRide {
  const samples: RideSample[] = []
  const push = (i: number, wallS: number) =>
    samples.push({
      timestampMs: T0 + wallS * 1000,
      elapsedS: i,
      distanceM: i * 5,
      lat: 45 + i * 0.00004,
      lon: 6,
      elevationM: 700 + i * 0.4,
      speedMps: 5,
      powerW: 200 + (i % 2) * 20,
      cadenceRpm: i % 10 === 0 ? 0 : 85,
      heartRateBpm: i < 5 ? null : 140,
      grade: 0.08,
    })
  for (let i = 1; i <= 60; i++) push(i, i)
  for (let i = 61; i <= 90; i++) push(i, i + 30)
  const events = [
    { timestampMs: T0, type: 'start' as const },
    { timestampMs: T0 + 60_000, type: 'stop' as const },
    { timestampMs: T0 + 90_000, type: 'start' as const },
    { timestampMs: T0 + 120_000, type: 'stop' as const },
  ]
  return {
    id: 'ride-1',
    routeId: 'route-1',
    routeName: 'Synthetic Lacets',
    startedAtMs: T0,
    endedAtMs: T0 + 120_000,
    samples,
    events,
    stats: computeRideStats(samples, T0, T0 + 120_000),
    settings: DEFAULT_RIDER_SETTINGS,
  }
}
