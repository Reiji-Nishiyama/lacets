/**
 * 表示用の単位変換。内部は SI 単位系（m, s, m/s, 勾配は小数）で統一し、変換は表示時のみ行う。
 */

const MPS_PER_KMH = 1000 / 3600

export function mpsToKmh(speedMps: number): number {
  return speedMps / MPS_PER_KMH
}

export function kmhToMps(speedKmh: number): number {
  return speedKmh * MPS_PER_KMH
}

/** 勾配（小数, 0.08 = 8%）を百分率に変換する。 */
export function gradeToPercent(grade: number): number {
  return grade * 100
}

export function percentToGrade(percent: number): number {
  return percent / 100
}

export function metersToKm(distanceM: number): number {
  return distanceM / 1000
}

/** 経過秒数を `h:mm:ss`（1時間未満は `m:ss`）に整形する。負値は 0 とみなす。 */
export function formatDuration(durationS: number): string {
  const totalS = Math.max(0, Math.floor(durationS))
  const h = Math.floor(totalS / 3600)
  const m = Math.floor((totalS % 3600) / 60)
  const s = totalS % 60
  const ss = String(s).padStart(2, '0')
  if (h === 0) return `${m}:${ss}`
  return `${h}:${String(m).padStart(2, '0')}:${ss}`
}
