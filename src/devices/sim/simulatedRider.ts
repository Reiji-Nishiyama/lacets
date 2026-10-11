/**
 * シミュレータ用の擬似ライダー。勾配に応じたパワー・ケイデンス・心拍を生成する純粋関数。
 * 実際の生理モデルではなく、画面や走行ループの動作確認に十分な「それらしい」値を返す。
 */

export type SimulatedRiderMode = 'fixed' | 'grade'

export interface SimulatedRiderSettings {
  mode: SimulatedRiderMode
  /** 平坦（勾配 0）でのパワー [W] */
  basePowerW: number
  /** 平坦でのケイデンス [rpm] */
  baseCadenceRpm: number
}

export const DEFAULT_SIMULATED_RIDER: SimulatedRiderSettings = {
  mode: 'grade',
  basePowerW: 200,
  baseCadenceRpm: 90,
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** 'grade' モードでは登りで踏み、下りで緩める（8% で約 1.3 倍、下りは 0.4 倍まで）。 */
export function simulatedPowerW(settings: SimulatedRiderSettings, grade: number): number {
  if (settings.mode === 'fixed') return settings.basePowerW
  return settings.basePowerW * clamp(1 + 4 * grade, 0.4, 1.8)
}

/** 'grade' モードでは登りでケイデンスが落ちる（実変速で軽くしても多少は落ちる想定）。 */
export function simulatedCadenceRpm(settings: SimulatedRiderSettings, grade: number): number {
  if (settings.mode === 'fixed') return settings.baseCadenceRpm
  return clamp(settings.baseCadenceRpm - 150 * grade, 50, 120)
}

/** パワーに応じた定常心拍 [bpm]。 */
export function steadyHeartRateBpm(powerW: number): number {
  return clamp(90 + 0.3 * powerW, 60, 195)
}

/** 心拍を定常値に向けて一次遅れで近づける（時定数 30 s）。 */
export function nextHeartRateBpm(currentBpm: number, powerW: number, dtS: number): number {
  const target = steadyHeartRateBpm(powerW)
  const alpha = 1 - Math.exp(-dtS / 30)
  return currentBpm + (target - currentBpm) * alpha
}
