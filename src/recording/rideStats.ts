import type { RideSample, RideStats } from './types.ts'

function average(values: number[]): number | null {
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null
}

/**
 * 記録から集計値を求める。サンプルは約 1 秒間隔なので単純平均を時間平均とみなす。
 * ケイデンスの平均は FIT の慣例に合わせて 0（足を止めている時間）を除く。
 */
export function computeRideStats(
  samples: RideSample[],
  startedAtMs: number,
  endedAtMs: number,
): RideStats {
  const last = samples[samples.length - 1]
  let ascentM = 0
  for (let i = 1; i < samples.length; i++) {
    const de = samples[i]!.elevationM - samples[i - 1]!.elevationM
    if (de > 0) ascentM += de
  }
  const hr = samples.flatMap((s) => (s.heartRateBpm == null ? [] : [s.heartRateBpm]))
  const cadence = samples.flatMap((s) => (s.cadenceRpm ? [s.cadenceRpm] : []))
  const movingTimeS = last?.elapsedS ?? 0
  return {
    movingTimeS,
    elapsedWallS: Math.max(0, (endedAtMs - startedAtMs) / 1000),
    distanceM: last?.distanceM ?? 0,
    ascentM,
    averagePowerW: average(samples.map((s) => s.powerW)) ?? 0,
    maxPowerW: Math.max(0, ...samples.map((s) => s.powerW)),
    averageSpeedMps: movingTimeS > 0 ? (last?.distanceM ?? 0) / movingTimeS : 0,
    maxSpeedMps: Math.max(0, ...samples.map((s) => s.speedMps)),
    averageCadenceRpm: average(cadence),
    averageHeartRateBpm: average(hr),
    maxHeartRateBpm: hr.length > 0 ? Math.max(...hr) : null,
  }
}
