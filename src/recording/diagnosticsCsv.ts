import { CDA_PRESETS_M2, type RiderSettings } from '../domain/rider.ts'
import type { RecordedRide } from './types.ts'

/**
 * 負荷のキャリブレーション（#7）の分析用 CSV。先頭の `#` 行に条件（設定値）を書く。
 * 単位は列名に付ける（速度は km/h、勾配は % にして表計算で読みやすくする）
 */

type Cell = string | number | null | undefined

function cell(v: Cell, digits?: number): string {
  if (v === null || v === undefined || (typeof v === 'number' && !Number.isFinite(v))) return ''
  if (typeof v === 'number') return digits === undefined ? String(v) : v.toFixed(digits)
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

function toCsv(meta: Record<string, Cell>, header: string[], rows: string[][]): string {
  const lines = [
    ...Object.entries(meta).map(([k, v]) => `# ${k}=${cell(v)}`),
    header.join(','),
    ...rows.map((r) => r.join(',')),
  ]
  return lines.join('\n') + '\n'
}

function settingsMeta(s: RiderSettings): Record<string, Cell> {
  return {
    rider_mass_kg: s.riderMassKg,
    bike_mass_kg: s.bikeMassKg,
    position: s.position,
    cda_m2: CDA_PRESETS_M2[s.position],
    crr: s.crr,
    difficulty: s.difficulty,
  }
}

const kmh = (mps: number | null | undefined) => (mps == null ? null : mps * 3.6)
const pct = (grade: number | null | undefined) => (grade == null ? null : grade * 100)

/** 走行記録の 1 秒ごとのサンプル */
export function rideDiagnosticsCsv(ride: RecordedRide): string {
  const startM = ride.startDistanceM ?? 0
  return toCsv(
    {
      app: 'Lacets',
      ride_id: ride.id,
      route: ride.routeName,
      reversed: ride.reversed ? 1 : 0,
      start_distance_m: startM,
      started_at: new Date(ride.startedAtMs).toISOString(),
      ...settingsMeta(ride.settings),
    },
    [
      'time',
      'elapsed_s',
      'route_distance_m',
      'travelled_m',
      'lat',
      'lon',
      'elevation_m',
      'route_grade_pct',
      'trainer_grade_pct',
      'power_w',
      'cadence_rpm',
      'heart_rate_bpm',
      'app_speed_kmh',
      'trainer_speed_kmh',
    ],
    ride.samples.map((s) => [
      cell(new Date(s.timestampMs).toISOString()),
      cell(s.elapsedS, 2),
      cell(s.distanceM, 1),
      cell(s.distanceM - startM, 1),
      cell(s.lat, 6),
      cell(s.lon, 6),
      cell(s.elevationM, 1),
      cell(pct(s.grade), 2),
      cell(pct(s.trainerGrade), 2),
      cell(s.powerW),
      cell(s.cadenceRpm),
      cell(s.heartRateBpm),
      cell(kmh(s.speedMps), 2),
      cell(kmh(s.trainerSpeedMps), 2),
    ]),
  )
}

/** デバイス画面の勾配テストの 1 秒ごとの記録 */
export interface ManualTestSample {
  timestampMs: number
  /** トレーナーに送っていた勾配 */
  grade: number
  powerW: number | null
  cadenceRpm: number | null
  heartRateBpm: number | null
  trainerSpeedMps: number | null
}

export function manualTestCsv(
  samples: readonly ManualTestSample[],
  meta: { crr: number; cdaM2: number; trainerName?: string },
): string {
  const t0 = samples[0]?.timestampMs ?? 0
  return toCsv(
    {
      app: 'Lacets',
      test: 'manual-grade',
      trainer: meta.trainerName,
      crr: meta.crr,
      cda_m2: meta.cdaM2,
      started_at: samples[0] ? new Date(t0).toISOString() : '',
    },
    [
      'time',
      'elapsed_s',
      'grade_pct',
      'power_w',
      'cadence_rpm',
      'heart_rate_bpm',
      'trainer_speed_kmh',
    ],
    samples.map((s) => [
      cell(new Date(s.timestampMs).toISOString()),
      cell((s.timestampMs - t0) / 1000, 1),
      cell(pct(s.grade), 2),
      cell(s.powerW),
      cell(s.cadenceRpm),
      cell(s.heartRateBpm),
      cell(kmh(s.trainerSpeedMps), 2),
    ]),
  )
}

export function diagnosticsFileName(prefix: string, startedAtMs: number): string {
  const d = new Date(startedAtMs)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `lacets-${prefix}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.csv`
}
