import { describe, expect, it } from 'vitest'
import { cwFromCda } from './aero.ts'

describe('cwFromCda', () => {
  it('CdA 0.32 m² → Cw ≈ 0.196 kg/m（docs/05-ble-ftms.md の例）', () => {
    expect(cwFromCda(0.32)).toBeCloseTo(0.196, 3)
  })
})
