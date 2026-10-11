import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SIMULATED_RIDER,
  nextHeartRateBpm,
  simulatedCadenceRpm,
  simulatedPowerW,
  steadyHeartRateBpm,
} from './simulatedRider.ts'

const fixed = { ...DEFAULT_SIMULATED_RIDER, mode: 'fixed' as const }
const grade = { ...DEFAULT_SIMULATED_RIDER, mode: 'grade' as const }

describe('simulatedRider', () => {
  it('fixed モードは勾配に依存しない', () => {
    expect(simulatedPowerW(fixed, 0.1)).toBe(200)
    expect(simulatedCadenceRpm(fixed, 0.1)).toBe(90)
  })

  it('grade モードは登りでパワーが上がりケイデンスが落ちる', () => {
    expect(simulatedPowerW(grade, 0)).toBe(200)
    expect(simulatedPowerW(grade, 0.08)).toBeCloseTo(264)
    expect(simulatedPowerW(grade, -0.2)).toBeCloseTo(80) // 下限 0.4 倍
    expect(simulatedPowerW(grade, 0.5)).toBeCloseTo(360) // 上限 1.8 倍
    expect(simulatedCadenceRpm(grade, 0.08)).toBeCloseTo(78)
    expect(simulatedCadenceRpm(grade, 0.5)).toBe(50)
  })

  it('心拍は定常値に向かって収束する', () => {
    expect(steadyHeartRateBpm(200)).toBe(150)
    let hr = 70
    for (let i = 0; i < 600; i++) hr = nextHeartRateBpm(hr, 200, 1)
    expect(hr).toBeCloseTo(150, 1)
    expect(nextHeartRateBpm(70, 200, 1)).toBeGreaterThan(70)
  })
})
