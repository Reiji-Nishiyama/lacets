import { formatDuration, gradeToPercent, metersToKm, mpsToKmh } from '../domain/units.ts'

/** 表示用の書式。単位は付けない（単位は i18n の文言で付ける） */

export function formatKm(distanceM: number, digits = 1): string {
  return metersToKm(distanceM).toFixed(digits)
}

export function formatKmh(speedMps: number): string {
  return mpsToKmh(speedMps).toFixed(1)
}

export function formatGradePct(grade: number): string {
  return gradeToPercent(grade).toFixed(1)
}

export function formatMeters(m: number): string {
  return Math.round(m).toLocaleString('ja-JP')
}

export function formatInt(value: number | null | undefined): string {
  return value == null ? '—' : String(Math.round(value))
}

/** 時間差 [s] を符号付きで（負 = 速い）: −0:12 / +1:05 / ±0:00 */
export function formatDelta(deltaS: number | null): string {
  if (deltaS === null) return '—'
  const rounded = Math.round(deltaS)
  if (rounded === 0) return '±0:00'
  return `${rounded < 0 ? '−' : '+'}${formatDuration(Math.abs(rounded))}`
}

/** 日時: 2026/10/12 09:30 */
export function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** 履歴の日付の札: 「10/25」 */
export function formatMonthDay(ms: number): string {
  const d = new Date(ms)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/** 履歴の日付の札: 「2026 年 7:05」 */
export function formatYearTime(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()} 年 ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function formatPercent(ratio: number): string {
  return String(Math.round(ratio * 100))
}
