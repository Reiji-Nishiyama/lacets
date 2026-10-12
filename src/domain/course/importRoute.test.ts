import { describe, expect, it } from 'vitest'
import { readFixture } from '../../../test/helpers/fixtures.ts'
import { importRoute } from './importRoute.ts'

describe('importRoute', () => {
  it('GPX からプロファイルと統計まで作る', () => {
    const r = importRoute(readFixture('track-two-segments.gpx'), 'fallback')
    expect(r.name).toBe('テスト峠')
    expect(r.format).toBe('gpx')
    expect(r.stats.distanceM).toBeCloseTo(333.6, 0)
    expect(r.profile[0]?.distanceM).toBe(0)
    expect(r.stats.ascentM).toBeGreaterThan(0)
  })

  it('名前がなければ fallbackName', () => {
    expect(importRoute(readFixture('activity.tcx'), 'my-ride').name).toBe('my-ride')
  })

  it('合成のつづら折りルート（13.8 km・平均約 8%）', () => {
    const r = importRoute(readFixture('synthetic-lacets.gpx'), 'x')
    expect(r.name).toBe('Synthetic Lacets')
    expect(r.stats.distanceM / 1000).toBeCloseTo(13.8, 1)
    expect(r.stats.ascentM).toBeGreaterThan(1100)
    expect(r.stats.ascentM).toBeLessThan(1130)
    expect(r.stats.maxGrade).toBeGreaterThan(0.095)
    expect(r.stats.maxGrade).toBeLessThan(0.105)
    expect(r.steepSections).toEqual([])
  })
})
