import { DEFAULT_PHYSICS, steadySpeedMps } from '../../domain/physics/model.ts'
import type { ConnectionState } from '../ConnectionState.ts'
import { Emitter, type Unsubscribe } from '../emitter.ts'
import {
  clampGrade,
  type SimulationParams,
  type TrainerCapabilities,
  type TrainerData,
  type TrainerDevice,
} from '../TrainerDevice.ts'
import {
  DEFAULT_SIMULATED_RIDER,
  simulatedCadenceRpm,
  simulatedPowerW,
  type SimulatedRiderSettings,
} from './simulatedRider.ts'

export interface SimulatedTrainerOptions {
  /** データ通知の間隔 [ms]。KICKR の Indoor Bike Data に合わせて 4 Hz */
  intervalMs?: number
  now?: () => number
  /** 0〜1 の乱数。テストでは固定値を渡す */
  random?: () => number
  /** パワーのゆらぎ（±割合） */
  noiseRatio?: number
  /**
   * 実機のトレーナーと同じく、内部で想定している総重量 [kg]（#7）。
   * 報告する速度（トレーナー速度）をこの重量で計算するので、勾配テストから逆算できる
   */
  assumedTotalMassKg?: number
}

const SIMULATED_CAPABILITIES: TrainerCapabilities = {
  gradeRange: { minGrade: -0.1, maxGrade: 0.2 },
  simulationSupported: true,
}

/**
 * 実機なしで開発・デモするための擬似トレーナー（F1-7）。`?sim=1` で使う。
 * 設定したパワー・ケイデンスを生成し、'grade' モードでは受け取った勾配に応じてパワーが変わる。
 */
export class SimulatedTrainer implements TrainerDevice {
  readonly kind = 'simulated'
  readonly name = 'Simulated Trainer'
  private _state: ConnectionState = 'disconnected'
  private timer: ReturnType<typeof setInterval> | null = null
  private dropoutTimer: ReturnType<typeof setTimeout> | null = null
  private grade = 0
  private crr = 0.004
  private cwKgPerM = 0.196
  private readonly assumedTotalMassKg: number
  private _settings: SimulatedRiderSettings = DEFAULT_SIMULATED_RIDER
  private readonly dataEmitter = new Emitter<TrainerData>()
  private readonly stateEmitter = new Emitter<ConnectionState>()
  private readonly intervalMs: number
  private readonly now: () => number
  private readonly random: () => number
  private readonly noiseRatio: number

  constructor(opts: SimulatedTrainerOptions = {}) {
    this.intervalMs = opts.intervalMs ?? 250
    this.now = opts.now ?? Date.now
    this.random = opts.random ?? Math.random
    this.noiseRatio = opts.noiseRatio ?? 0.03
    this.assumedTotalMassKg = opts.assumedTotalMassKg ?? 82
  }

  get state(): ConnectionState {
    return this._state
  }

  get capabilities(): TrainerCapabilities | null {
    return this._state === 'disconnected' ? null : SIMULATED_CAPABILITIES
  }

  get settings(): SimulatedRiderSettings {
    return this._settings
  }

  /** 送信中の（クランプ済みの）勾配。テストと画面表示用 */
  get currentGrade(): number {
    return this.grade
  }

  setSettings(settings: Partial<SimulatedRiderSettings>): void {
    this._settings = { ...this._settings, ...settings }
  }

  async connect(): Promise<void> {
    if (this._state !== 'disconnected') return
    this.setState('connecting')
    this.setState('connected')
    this.startTicking()
  }

  async disconnect(): Promise<void> {
    this.stopTicking()
    if (this.dropoutTimer !== null) clearTimeout(this.dropoutTimer)
    this.dropoutTimer = null
    this.setState('disconnected')
  }

  async setSimulation(params: SimulationParams): Promise<void> {
    this.grade = clampGrade(params.grade, SIMULATED_CAPABILITIES.gradeRange)
    this.crr = params.crr
    this.cwKgPerM = params.cwKgPerM
  }

  /** 一時的な切断を再現する（自動再接続と走行一時停止の確認用）。 */
  simulateDropout(durationMs = 3000): void {
    if (this._state !== 'connected') return
    this.stopTicking()
    this.setState('reconnecting')
    this.dropoutTimer = setTimeout(() => {
      this.dropoutTimer = null
      this.setState('connected')
      this.startTicking()
    }, durationMs)
  }

  onData(cb: (data: TrainerData) => void): Unsubscribe {
    return this.dataEmitter.on(cb)
  }

  onStateChange(cb: (state: ConnectionState) => void): Unsubscribe {
    return this.stateEmitter.on(cb)
  }

  private startTicking() {
    this.stopTicking()
    this.timer = setInterval(() => this.tick(), this.intervalMs)
  }

  private stopTicking() {
    if (this.timer !== null) clearInterval(this.timer)
    this.timer = null
  }

  private tick() {
    const noise = 1 + (this.random() * 2 - 1) * this.noiseRatio
    const powerW = Math.round(simulatedPowerW(this._settings, this.grade) * noise)
    const cadenceRpm = Math.round(simulatedCadenceRpm(this._settings, this.grade))
    // 実機と同じく、想定総重量で釣り合う速度を報告する（走行の計算には使われない）
    const trainerSpeedMps = steadySpeedMps(powerW, this.grade, {
      ...DEFAULT_PHYSICS,
      totalMassKg: this.assumedTotalMassKg,
      cdaM2: this.cwKgPerM / (0.5 * DEFAULT_PHYSICS.airDensityKgPerM3),
      crr: this.crr,
    })
    this.dataEmitter.emit({ powerW, cadenceRpm, trainerSpeedMps, timestampMs: this.now() })
  }

  private setState(state: ConnectionState) {
    if (this._state === state) return
    this._state = state
    this.stateEmitter.emit(state)
  }
}
