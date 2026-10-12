import { describe, expect, it } from 'vitest'
import { GRAVITY_MPS2 } from '../physics/model.ts'
import { compensateForTrainerMass, estimateTrainerMass } from './trainerMass.ts'

const CRR = 0.004
const CW = 0.196

/** 想定総重量 m のトレーナーが、勾配 grade・速度 v で要求するパワー */
const trainerPower = (m: number, grade: number, v: number) => {
  const th = Math.atan(grade)
  return v * (m * GRAVITY_MPS2 * (Math.sin(th) + CRR * Math.cos(th)) + CW * v * v)
}

describe('estimateTrainerMass', () => {
  it('勾配・速度・パワーから想定総重量を逆算する（落ち着くまでと平坦は使わない）', () => {
    const samples = [
      // 平坦（使わない）
      ...Array.from({ length: 60 }, () => ({ grade: 0, powerW: 150, trainerSpeedMps: 8 })),
      // 9%（最初の 20 秒は使わない）
      ...Array.from({ length: 90 }, (_, i) => {
        const v = 2.2 + 0.1 * Math.sin(i)
        return { grade: 0.09, powerW: i < 20 ? 400 : trainerPower(82, 0.09, v), trainerSpeedMps: v }
      }),
    ]
    const est = estimateTrainerMass(samples, { crr: CRR, cwKgPerM: CW })
    expect(est?.samples).toBe(70)
    expect(est?.massKg).toBeCloseTo(82, 0)
  })

  it('使えるサンプルが少なければ null', () => {
    const samples = Array.from({ length: 40 }, () => ({
      grade: 0.09,
      powerW: 160,
      trainerSpeedMps: 2.2,
    }))
    expect(estimateTrainerMass(samples, { crr: CRR, cwKgPerM: CW })).toBeNull()
  })
})

describe('compensateForTrainerMass', () => {
  it('補正後の勾配・Crr で、想定総重量のトレーナーが実際の総重量と同じ力を出す', () => {
    const actual = 68.8
    const trainer = 82.1
    const k = actual / trainer
    const { grade, crr } = compensateForTrainerMass(0.09, CRR, k)
    const force = (m: number, g: number, c: number) => {
      const th = Math.atan(g)
      return m * GRAVITY_MPS2 * (Math.sin(th) + c * Math.cos(th))
    }
    expect(force(trainer, grade, crr)).toBeCloseTo(force(actual, 0.09, CRR), 1)
    expect(grade).toBeCloseTo(0.09 * k, 3)
  })

  it('比が 1 なら変えない。下りも同じ比で縮める', () => {
    expect(compensateForTrainerMass(0.05, CRR, 1)).toEqual({ grade: 0.05, crr: CRR })
    expect(compensateForTrainerMass(-0.08, CRR, 0.8).grade).toBeCloseTo(-0.064, 3)
  })
})
