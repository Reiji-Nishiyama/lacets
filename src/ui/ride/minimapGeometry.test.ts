import { describe, expect, it } from 'vitest'
import { northboundRoute } from '../../../test/helpers/syntheticRoute.ts'
import { buildProfile } from '../../domain/course/profile.ts'
import { minimapGeometry } from './minimapGeometry.ts'

describe('minimapGeometry', () => {
  const { profile } = buildProfile(
    northboundRoute(1000, 10, () => 0),
    'dem',
  )
  const g = minimapGeometry(profile, 200, 100, 10)

  it('北向きのルートは下から上へ、枠の中央に収まる', () => {
    const start = g.pointAt(0)
    const end = g.pointAt(1000)
    expect(start.y).toBeCloseTo(90, 0)
    expect(end.y).toBeCloseTo(10, 0)
    expect(start.x).toBeCloseTo(100, 0)
    expect(end.x).toBeCloseTo(100, 0)
  })

  it('途中まで（走った部分）の線と現在位置', () => {
    expect(g.pointAt(500).y).toBeCloseTo(50, 0)
    const until = g.until(500).split(' ')
    expect(until.length).toBeGreaterThan(40)
    expect(until.at(-1)).toBe('100.0,50.0')
  })
})
