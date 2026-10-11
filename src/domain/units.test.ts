import { describe, expect, it } from 'vitest'
import {
  formatDuration,
  gradeToPercent,
  kmhToMps,
  metersToKm,
  mpsToKmh,
  percentToGrade,
} from './units.ts'

describe('units', () => {
  it('m/s と km/h を相互変換する', () => {
    expect(mpsToKmh(10)).toBeCloseTo(36)
    expect(kmhToMps(36)).toBeCloseTo(10)
    expect(mpsToKmh(kmhToMps(33.3))).toBeCloseTo(33.3)
  })

  it('勾配の小数と百分率を相互変換する', () => {
    expect(gradeToPercent(0.08)).toBeCloseTo(8)
    expect(percentToGrade(-3.5)).toBeCloseTo(-0.035)
  })

  it('m を km に変換する', () => {
    expect(metersToKm(13_800)).toBeCloseTo(13.8)
  })

  it('経過時間を整形する', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(59.9)).toBe('0:59')
    expect(formatDuration(605)).toBe('10:05')
    expect(formatDuration(3600 + 2 * 60 + 3)).toBe('1:02:03')
    expect(formatDuration(-5)).toBe('0:00')
  })
})
