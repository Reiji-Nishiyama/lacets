import type { ConnectionState } from './ConnectionState.ts'
import type { Unsubscribe } from './emitter.ts'

export interface SimulationParams {
  /** 向かい風を正とする風速 [m/s] */
  windSpeedMps: number
  /** 勾配（小数, 0.08 = 8%） */
  grade: number
  /** 転がり抵抗係数 */
  crr: number
  /** 風抵抗係数 Cw = 0.5·ρ·CdA [kg/m] */
  cwKgPerM: number
}

export interface TrainerData {
  powerW: number
  cadenceRpm?: number
  /** トレーナー経由で心拍が届く場合のみ */
  heartRateBpm?: number
  /** 受信時刻（Date.now() と同じ基準）[ms] */
  timestampMs: number
}

export interface GradeRange {
  minGrade: number
  maxGrade: number
}

export interface TrainerCapabilities {
  /** 送信する勾配のクランプ範囲 */
  gradeRange: GradeRange
  simulationSupported: boolean
}

/**
 * スマートトレーナーの上位抽象。実装は FtmsTrainer（BLE）と SimulatedTrainer。
 * 速度はトレーナーの報告値を使わず、アプリ側の物理モデルで計算する（設計原則 3）。
 */
export interface TrainerDevice {
  readonly kind: 'ftms' | 'simulated'
  readonly state: ConnectionState
  readonly name: string | undefined
  /** 接続後に判明する。未接続時は null */
  readonly capabilities: TrainerCapabilities | null
  connect(): Promise<void>
  disconnect(): Promise<void>
  /**
   * SIM モードのパラメータを送る。勾配は capabilities.gradeRange にクランプされる。
   * 送信待ちの間に再度呼ばれた場合は最新の値だけを送る。未接続時は保持して接続時に送る。
   */
  setSimulation(params: SimulationParams): Promise<void>
  onData(cb: (data: TrainerData) => void): Unsubscribe
  onStateChange(cb: (state: ConnectionState) => void): Unsubscribe
}

export function clampGrade(grade: number, range: GradeRange): number {
  return Math.min(range.maxGrade, Math.max(range.minGrade, grade))
}
