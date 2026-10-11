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
})
