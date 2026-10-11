import { describe, expect, it } from 'vitest'
import { DEFAULT_RIDER_SETTINGS, physicsParamsFor } from './rider.ts'

describe('physicsParamsFor', () => {
  it('体重とバイク重量を合算し、ポジションから CdA を決める', () => {
    const p = physicsParamsFor({ ...DEFAULT_RIDER_SETTINGS, riderMassKg: 70, position: 'drops' })
    expect(p.totalMassKg).toBe(78)
    expect(p.cdaM2).toBe(0.28)
    expect(p.crr).toBe(0.004)
  })
})
