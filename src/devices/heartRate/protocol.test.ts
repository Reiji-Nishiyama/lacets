import { describe, expect, it } from 'vitest'
import { dv } from '../../../test/helpers/bytes.ts'
import { decodeHeartRateMeasurement } from './protocol.ts'

describe('decodeHeartRateMeasurement', () => {
  it('uint8 形式', () => {
    expect(decodeHeartRateMeasurement(dv(0x00, 0x8c))).toEqual({
      heartRateBpm: 140,
      rrIntervalsS: [],
    })
  })

  it('uint16 形式', () => {
    expect(decodeHeartRateMeasurement(dv(0x01, 0x2c, 0x01))?.heartRateBpm).toBe(300)
  })

  it('Energy Expended を読み飛ばして RR 間隔を読む', () => {
    // flags = 0x18（energy + RR）, hr 120, energy 0x0010, RR 1024 (1.0 s), 512 (0.5 s)
    const m = decodeHeartRateMeasurement(dv(0x18, 0x78, 0x10, 0x00, 0x00, 0x04, 0x00, 0x02))
    expect(m).toEqual({ heartRateBpm: 120, rrIntervalsS: [1, 0.5] })
  })

  it('短すぎるデータは null', () => {
    expect(decodeHeartRateMeasurement(dv(0x00))).toBeNull()
    expect(decodeHeartRateMeasurement(dv(0x01, 0x2c))).toBeNull()
  })
})
