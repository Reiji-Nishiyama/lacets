import { GRAVITY_MPS2 } from '../physics/model.ts'

/**
 * トレーナーが想定している総重量の推定（#7）。
 * 標準 FTMS の SIM モードには体重を送る項目がなく、トレーナーは内部の想定重量で坂の負荷を計算する。
 * 送った勾配・Crr・Cw と、トレーナーが報告する速度・パワーから逆算する:
 *   P = v · (m g (sinθ + Crr cosθ) + Cw v²)  →  m = (P / v − Cw v²) / (g (sinθ + Crr cosθ))
 */
export interface TrainerMassSample {
  /** 送った勾配（小数） */
  grade: number
  powerW: number | null
  trainerSpeedMps: number | null
}

export interface TrainerMassOptions {
  crr: number
  cwKgPerM: number
  /** この勾配以上のサンプルだけ使う（平坦では重さの影響が小さく推定が不安定） */
  minGrade: number
  /** 勾配を変えてから、この秒数は落ち着くまで使わない */
  settleS: number
}

export const DEFAULT_TRAINER_MASS_OPTIONS: Omit<TrainerMassOptions, 'crr' | 'cwKgPerM'> = {
  minGrade: 0.03,
  settleS: 20,
}

export interface TrainerMassEstimate {
  massKg: number
  /** 推定に使ったサンプル数 */
  samples: number
}

/** 1 秒ごとのサンプルから想定総重量を推定する（中央値）。使えるサンプルが 30 未満なら null */
export function estimateTrainerMass(
  samples: readonly TrainerMassSample[],
  options: Pick<TrainerMassOptions, 'crr' | 'cwKgPerM'> & Partial<TrainerMassOptions>,
): TrainerMassEstimate | null {
  const opts = { ...DEFAULT_TRAINER_MASS_OPTIONS, ...options }
  const values: number[] = []
  let sinceChange = 0
  let prevGrade: number | null = null
  for (const s of samples) {
    sinceChange = s.grade === prevGrade ? sinceChange + 1 : 0
    prevGrade = s.grade
    if (sinceChange < opts.settleS || s.grade < opts.minGrade) continue
    const v = s.trainerSpeedMps
    const p = s.powerW
    if (!v || v < 1 || !p || p < 50) continue
    const theta = Math.atan(s.grade)
    const m =
      (p / v - opts.cwKgPerM * v * v) /
      (GRAVITY_MPS2 * (Math.sin(theta) + opts.crr * Math.cos(theta)))
    if (Number.isFinite(m) && m > 20 && m < 250) values.push(m)
  }
  if (values.length < 30) return null
  values.sort((a, b) => a - b)
  const mid = Math.floor(values.length / 2)
  const massKg = values.length % 2 ? values[mid]! : (values[mid - 1]! + values[mid]!) / 2
  return { massKg, samples: values.length }
}

/**
 * トレーナーに送る勾配と Crr を、想定総重量と実際の総重量の比で補正する。
 * トレーナーは m_trainer として坂の力を計算するので、m_actual / m_trainer 倍に縮めて送る:
 *   sinθ' = k sinθ、Crr' = k Crr（k = m_actual / m_trainer）
 * 空気抵抗（Cw）は重さに依存しないのでそのまま
 */
export function compensateForTrainerMass(
  grade: number,
  crr: number,
  massRatio: number,
): { grade: number; crr: number } {
  if (massRatio === 1) return { grade, crr }
  const sin = Math.min(1, Math.max(-1, massRatio * Math.sin(Math.atan(grade))))
  return { grade: Math.tan(Math.asin(sin)), crr: crr * massRatio }
}
