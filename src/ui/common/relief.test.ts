import { describe, expect, it } from 'vitest'
import { contourIntervalM, RELIEF_COLORS, reliefColor } from './relief.ts'

describe('relief', () => {
  it('両端は最初と最後の色、途中は補間', () => {
    expect(reliefColor(0)).toBe(RELIEF_COLORS[0])
    expect(reliefColor(1)).toBe(RELIEF_COLORS.at(-1))
    expect(reliefColor(-1)).toBe(RELIEF_COLORS[0])
    expect(reliefColor(0.1)).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('等高線の間隔は帯が 14 本以下になるきりのよい値', () => {
    expect(contourIntervalM(720, 1843)).toBe(100)
    expect(contourIntervalM(0, 60)).toBe(10)
    expect(contourIntervalM(0, 2500)).toBe(200)
    expect(contourIntervalM(10, 10)).toBe(10)
  })
})
