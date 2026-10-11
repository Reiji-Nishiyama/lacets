import type { ConnectionState } from '../ConnectionState.ts'
import { Emitter, type Unsubscribe } from '../emitter.ts'
import type { HeartRateData, HeartRateSensor } from '../HeartRateSensor.ts'
import type { TrainerDevice } from '../TrainerDevice.ts'
import { nextHeartRateBpm } from './simulatedRider.ts'

/** トレーナーのパワーに追従して心拍を生成する擬似心拍計。1 Hz で通知する。 */
export class SimulatedHeartRateSensor implements HeartRateSensor {
  readonly kind = 'simulated'
  readonly name = 'Simulated HRM'
  private _state: ConnectionState = 'disconnected'
  private heartRateBpm = 70
  private latestPowerW = 0
  private timer: ReturnType<typeof setInterval> | null = null
  private offTrainer: Unsubscribe | null = null
  private readonly dataEmitter = new Emitter<HeartRateData>()
  private readonly stateEmitter = new Emitter<ConnectionState>()

  private readonly trainer: TrainerDevice
  private readonly now: () => number

  constructor(trainer: TrainerDevice, now: () => number = Date.now) {
    this.trainer = trainer
    this.now = now
  }

  get state(): ConnectionState {
    return this._state
  }

  async connect(): Promise<void> {
    if (this._state !== 'disconnected') return
    this.offTrainer = this.trainer.onData((d) => {
      this.latestPowerW = d.powerW
    })
    this.timer = setInterval(() => {
      this.heartRateBpm = nextHeartRateBpm(this.heartRateBpm, this.latestPowerW, 1)
      this.dataEmitter.emit({
        heartRateBpm: Math.round(this.heartRateBpm),
        timestampMs: this.now(),
      })
    }, 1000)
    this.setState('connected')
  }

  async disconnect(): Promise<void> {
    if (this.timer !== null) clearInterval(this.timer)
    this.timer = null
    this.offTrainer?.()
    this.offTrainer = null
    this.setState('disconnected')
  }

  onData(cb: (data: HeartRateData) => void): Unsubscribe {
    return this.dataEmitter.on(cb)
  }

  onStateChange(cb: (state: ConnectionState) => void): Unsubscribe {
    return this.stateEmitter.on(cb)
  }

  private setState(state: ConnectionState) {
    if (this._state === state) return
    this._state = state
    this.stateEmitter.emit(state)
  }
}
