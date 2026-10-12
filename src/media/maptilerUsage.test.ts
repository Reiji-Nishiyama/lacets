import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  countMaptilerRequest,
  flushMaptilerUsage,
  maptilerRequestWeight,
  maptilerUsageThisMonth,
  usageMonthKey,
} from './maptilerUsage.ts'

const store = new Map<string, string>()

beforeEach(() => {
  store.clear()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  })
})

afterEach(() => {
  flushMaptilerUsage()
  vi.unstubAllGlobals()
})

describe('maptilerUsage', () => {
  it('画像タイルは 4、ベクタータイル・スタイル等は 1 と数える', () => {
    expect(
      maptilerRequestWeight('https://api.maptiler.com/tiles/satellite-v2/15/1/2.jpg?key=x'),
    ).toBe(4)
    expect(maptilerRequestWeight('https://api.maptiler.com/tiles/v3/15/1/2.pbf?key=x')).toBe(1)
    expect(maptilerRequestWeight('https://api.maptiler.com/maps/hybrid/style.json?key=x')).toBe(1)
  })

  it('月ごとに数え、MapTiler 以外は数えない', () => {
    const oct = new Date('2026-10-15T00:00:00Z')
    countMaptilerRequest('https://api.maptiler.com/tiles/satellite-v2/1/1/1.jpg?key=x', oct)
    countMaptilerRequest('https://api.maptiler.com/maps/hybrid/style.json?key=x', oct)
    countMaptilerRequest('https://tiles.openfreemap.org/x.pbf', oct)
    expect(maptilerUsageThisMonth(oct)).toBe(5)
    flushMaptilerUsage()
    expect(store.get('lacets.maptilerUsage.2026-10')).toBe('5')
    // 翌月は 0 から
    const nov = new Date('2026-11-01T00:00:00Z')
    expect(maptilerUsageThisMonth(nov)).toBe(0)
    countMaptilerRequest('https://api.maptiler.com/maps/hybrid/style.json?key=x', nov)
    expect(maptilerUsageThisMonth(nov)).toBe(1)
    expect(maptilerUsageThisMonth(oct)).toBe(5)
  })

  it('usageMonthKey', () => {
    expect(usageMonthKey(new Date('2026-01-31T23:59:59Z'))).toBe('2026-01')
  })
})
