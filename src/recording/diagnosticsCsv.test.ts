import { describe, expect, it } from 'vitest'
import { sampleRide } from '../../test/helpers/recordedRide.ts'
import { diagnosticsFileName, manualTestCsv, rideDiagnosticsCsv } from './diagnosticsCsv.ts'

describe('rideDiagnosticsCsv', () => {
  it('条件の # 行、ヘッダ、1 秒ごとの行', () => {
    const base = sampleRide()
    const ride = {
      ...base,
      routeName: 'Alpe, "test"',
      startDistanceM: 1000,
      samples: base.samples.map((s, i) => ({
        ...s,
        distanceM: 1000 + s.distanceM,
        trainerGrade: i === 0 ? null : 0.08,
        trainerSpeedMps: 5.5,
      })),
    }
    const lines = rideDiagnosticsCsv(ride).trimEnd().split('\n')
    expect(lines).toContain('# route="Alpe, ""test"""')
    expect(lines).toContain('# start_distance_m=1000')
    expect(lines).toContain('# cda_m2=0.32')
    expect(lines).toContain('# difficulty=1')
    const header = lines.find((l) => l.startsWith('time,'))!
    expect(header.split(',')).toContain('trainer_speed_kmh')
    const rows = lines.slice(lines.indexOf(header) + 1)
    expect(rows).toHaveLength(90)
    const row = rows[1]!.split(',')
    const col = (name: string) => row[header.split(',').indexOf(name)]
    expect(col('travelled_m')).toBe('10.0')
    expect(col('route_grade_pct')).toBe('8.00')
    expect(col('trainer_grade_pct')).toBe('8.00')
    expect(col('app_speed_kmh')).toBe('18.00')
    expect(col('trainer_speed_kmh')).toBe('19.80')
    // 欠測は空欄
    expect(rows[0]!.split(',')[header.split(',').indexOf('trainer_grade_pct')]).toBe('')
  })
})

describe('manualTestCsv', () => {
  it('勾配テストの記録', () => {
    const csv = manualTestCsv(
      [
        {
          timestampMs: 0,
          grade: 0,
          powerW: 120,
          cadenceRpm: 80,
          heartRateBpm: null,
          trainerSpeedMps: 8,
        },
        {
          timestampMs: 1000,
          grade: 0.04,
          powerW: 160,
          cadenceRpm: 79,
          heartRateBpm: 130,
          trainerSpeedMps: null,
        },
      ],
      { crr: 0.004, cdaM2: 0.32, trainerName: 'KICKR CORE' },
    )
    const lines = csv.trimEnd().split('\n')
    expect(lines).toContain('# trainer=KICKR CORE')
    expect(lines.at(-1)).toBe('1970-01-01T00:00:01.000Z,1.0,4.00,160,79,130,')
  })

  it('ファイル名', () => {
    expect(diagnosticsFileName('ride', new Date(2026, 9, 12, 9, 5).getTime())).toBe(
      'lacets-ride-20261012-0905.csv',
    )
  })
})
