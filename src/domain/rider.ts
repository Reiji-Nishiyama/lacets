import { DEFAULT_PHYSICS, type PhysicsParams } from './physics/model.ts'

/** 乗車ポジションごとの CdA [m²]（docs/02-architecture.md §5） */
export const CDA_PRESETS_M2 = {
  hoods: 0.32,
  drops: 0.28,
  /** ヒルクライム（ブラケットを持った低速の上体を起こした姿勢） */
  climbing: 0.36,
} as const

export type PositionPreset = keyof typeof CDA_PRESETS_M2

/**
 * 路面ごとの転がり抵抗係数。実走の惰性走行（#7、docs/06-calibration.md）では 0.005 前後が合ったので、
 * 既定は「普通の舗装」にする
 */
export const CRR_PRESETS = {
  smooth: 0.004,
  normal: 0.005,
  rough: 0.006,
} as const

export type RoadSurface = keyof typeof CRR_PRESETS

export interface RiderSettings {
  riderMassKg: number
  bikeMassKg: number
  position: PositionPreset
  crr: number
  /** 勾配の再現度（0〜1）。トレーナーに送る勾配に掛ける。既定 1（実勾配の再現がコンセプト） */
  difficulty: number
}

export const DEFAULT_RIDER_SETTINGS: RiderSettings = {
  riderMassKg: 65,
  bikeMassKg: 8,
  position: 'hoods',
  crr: CRR_PRESETS.normal,
  difficulty: 1,
}

export function physicsParamsFor(s: RiderSettings): PhysicsParams {
  return {
    ...DEFAULT_PHYSICS,
    totalMassKg: s.riderMassKg + s.bikeMassKg,
    cdaM2: CDA_PRESETS_M2[s.position],
    crr: s.crr,
  }
}
