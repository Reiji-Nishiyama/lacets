import { describe, expect, it } from 'vitest'
import { dv, hex } from '../../../test/helpers/bytes.ts'
import {
  decodeControlPointResponse,
  decodeFeatures,
  decodeInclinationRange,
  decodeIndoorBikeData,
  decodeStatusOpCode,
  encodeRequestControl,
  encodeSetSimulation,
  encodeStartOrResume,
  encodeStopOrPause,
  resultCodeName,
} from './protocol.ts'

describe('Control Point のエンコード', () => {
  it('Request Control / Start / Stop / Pause', () => {
    expect(hex(encodeRequestControl())).toEqual([0x00])
    expect(hex(encodeStartOrResume())).toEqual([0x07])
    expect(hex(encodeStopOrPause('stop'))).toEqual([0x08, 0x01])
    expect(hex(encodeStopOrPause('pause'))).toEqual([0x08, 0x02])
  })

  it('docs/05-ble-ftms.md の例: grade 8%, Crr 0.004, Cw 0.20, 風速 0', () => {
    const bytes = encodeSetSimulation({ windSpeedMps: 0, grade: 0.08, crr: 0.004, cwKgPerM: 0.2 })
    expect(hex(bytes)).toEqual([0x11, 0x00, 0x00, 0x20, 0x03, 0x28, 0x14])
  })

  it('CdA 0.32 から求めた Cw ≈ 0.196 は 20 (0.20 kg/m) に丸める', () => {
    const bytes = encodeSetSimulation({
      windSpeedMps: 0,
      grade: 0,
      crr: 0.004,
      cwKgPerM: 0.5 * 1.225 * 0.32,
    })
    expect(bytes[6]).toBe(20)
  })

  it('負の勾配と風速はリトルエンディアンの 2 の補数', () => {
    // grade -5% = -500 = 0xFE0C, 風速 -1.5 m/s = -1500 = 0xFA24
    const bytes = encodeSetSimulation({ windSpeedMps: -1.5, grade: -0.05, crr: 0, cwKgPerM: 0 })
    expect(hex(bytes)).toEqual([0x11, 0x24, 0xfa, 0x0c, 0xfe, 0x00, 0x00])
  })

  it('表現範囲外の値はクランプする', () => {
    const bytes = encodeSetSimulation({ windSpeedMps: 100, grade: 10, crr: 1, cwKgPerM: 9 })
    expect(hex(bytes)).toEqual([0x11, 0xff, 0x7f, 0xff, 0x7f, 0xff, 0xff])
    const neg = encodeSetSimulation({ windSpeedMps: 0, grade: 0, crr: -1, cwKgPerM: -1 })
    expect(hex(neg).slice(5)).toEqual([0x00, 0x00])
  })
})

describe('Control Point 応答のデコード', () => {
  it('成功応答', () => {
    expect(decodeControlPointResponse(dv(0x80, 0x00, 0x01))).toEqual({
      requestOpCode: 0x00,
      resultCode: 0x01,
    })
  })

  it('Control Not Permitted', () => {
    expect(decodeControlPointResponse(dv(0x80, 0x11, 0x05))?.resultCode).toBe(0x05)
    expect(resultCodeName(0x05)).toBe('ControlNotPermitted')
    expect(resultCodeName(0x42)).toBe('Unknown(0x42)')
  })

  it('応答でないデータは null', () => {
    expect(decodeControlPointResponse(dv(0x11, 0x00, 0x01))).toBeNull()
    expect(decodeControlPointResponse(dv(0x80, 0x00))).toBeNull()
  })
})

describe('Indoor Bike Data のデコード', () => {
  it('速度・ケイデンス・パワー（KICKR の典型的なフラグ 0x0044）', () => {
    // flags = 0x0044: bit2 cadence, bit6 power, bit0=0 なので速度あり
    // speed 3000 (30.00 km/h) = 0x0BB8, cadence 180 (90 rpm) = 0x00B4, power 250 = 0x00FA
    const data = decodeIndoorBikeData(dv(0x44, 0x00, 0xb8, 0x0b, 0xb4, 0x00, 0xfa, 0x00))
    expect(data.speedMps).toBeCloseTo(30 / 3.6)
    expect(data.cadenceRpm).toBe(90)
    expect(data.powerW).toBe(250)
    expect(data.heartRateBpm).toBeUndefined()
  })

  it('More Data = 1 のときは速度フィールドがない（反転論理）', () => {
    // flags = 0x0041: bit0 More Data, bit6 power
    const data = decodeIndoorBikeData(dv(0x41, 0x00, 0x2c, 0x01))
    expect(data.speedMps).toBeUndefined()
    expect(data.powerW).toBe(300)
  })

  it('全フィールドを順にオフセットを進めて読む', () => {
    // flags = bit1..12 すべて, bit0=0（速度あり） → 0x1FFE
    // prettier-ignore
    const bytes = [
      0xfe, 0x1f,
      0xe8, 0x03, // speed 1000 = 10 km/h
      0xd0, 0x07, // avg speed 2000 = 20 km/h
      0xa0, 0x00, // cadence 160 = 80 rpm
      0x96, 0x00, // avg cadence 150 = 75 rpm
      0x10, 0x27, 0x01, // total distance 0x012710 = 75536 m
      0xfb, 0xff, // resistance -5
      0x38, 0xff, // power -200（sint16）
      0x64, 0x00, // avg power 100
      0x2c, 0x01, 0x00, 0x00, 0x00, // energy total 300 kcal, per hour, per minute
      0x8c, // heart rate 140
      0x0a, // MET（読み飛ばし）
      0x10, 0x0e, // elapsed 3600 s
      0x3c, 0x00, // remaining 60 s
    ]
    const data = decodeIndoorBikeData(dv(...bytes))
    expect(data).toEqual({
      speedMps: expect.closeTo(10 / 3.6, 6),
      averageSpeedMps: expect.closeTo(20 / 3.6, 6),
      cadenceRpm: 80,
      averageCadenceRpm: 75,
      totalDistanceM: 75536,
      resistanceLevel: -5,
      powerW: -200,
      averagePowerW: 100,
      totalEnergyKcal: 300,
      heartRateBpm: 140,
      elapsedTimeS: 3600,
      remainingTimeS: 60,
    })
  })

  it('未知のフラグ（RFU）があっても落ちない', () => {
    const data = decodeIndoorBikeData(dv(0x41, 0xe0, 0x64, 0x00))
    expect(data.powerW).toBe(100)
  })

  it('切り詰められたパケットは読めたところまで返す', () => {
    expect(decodeIndoorBikeData(dv(0x44, 0x00, 0xb8, 0x0b, 0xb4))).toEqual({
      speedMps: expect.closeTo(30 / 3.6, 6),
    })
    expect(decodeIndoorBikeData(dv(0x00))).toEqual({})
  })
})

describe('Feature / Inclination Range / Status のデコード', () => {
  it('Fitness Machine Feature', () => {
    // machine: bit1 cadence, bit14 power = 0x00004002, target: bit13 sim = 0x00002000
    const features = decodeFeatures(dv(0x02, 0x40, 0x00, 0x00, 0x00, 0x20, 0x00, 0x00))
    expect(features).toEqual({
      cadenceSupported: true,
      heartRateMeasurementSupported: false,
      powerMeasurementSupported: true,
      indoorBikeSimulationSupported: true,
    })
  })

  it('Supported Inclination Range（0.1% 単位）', () => {
    // min -100 (-10.0%), max 200 (20.0%), increment 5 (0.5%)
    expect(decodeInclinationRange(dv(0x9c, 0xff, 0xc8, 0x00, 0x05, 0x00))).toEqual({
      minGrade: -0.1,
      maxGrade: 0.2,
    })
    expect(decodeInclinationRange(dv(0x00))).toBeNull()
  })

  it('Fitness Machine Status の opcode', () => {
    expect(decodeStatusOpCode(dv(0xff))).toBe(0xff)
    expect(decodeStatusOpCode(dv())).toBeNull()
  })
})
