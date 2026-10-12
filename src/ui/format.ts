import { gradeToPercent, metersToKm, mpsToKmh } from '../domain/units.ts'

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
