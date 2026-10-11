import type { ConnectionState } from '../ConnectionState.ts'
import { Emitter, type Unsubscribe } from '../emitter.ts'
import type { BleDeviceRef, BleTransport, RequestDeviceOptions } from './BleTransport.ts'

export interface ManagedConnectionOptions {
  transport: BleTransport
  request: RequestDeviceOptions
  /**
   * 接続・再接続のたびに呼ばれる。購読や初期化コマンドを行い、切断時の後始末関数を返す。
   * 例外を投げた場合は接続失敗として扱う。
   */
  setup: (dev: BleDeviceRef) => Promise<(() => void) | void>
  /** 予期しない切断後の再接続の待ち時間 [ms]。末尾の値を最後の試行まで繰り返す */
  retryDelaysMs?: number[]
  maxRetries?: number
}

const DEFAULT_RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 15000]
const DEFAULT_MAX_RETRIES = 20

/**
 * BLE デバイス 1 台との接続を管理する。デバイス選択・接続・初期化と、
 * 予期しない切断時の自動再接続（指数バックオフ）を受け持つ（F1-6）。
 */
export class ManagedConnection {
  private _state: ConnectionState = 'disconnected'
  private device: BleDeviceRef | null = null
  private cleanup: (() => void) | null = null
  private offDisconnected: Unsubscribe | null = null
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private retryCount = 0
  /** 意図的な切断中は切断イベントで再接続しない */
  private intentional = false
  private readonly stateEmitter = new Emitter<ConnectionState>()

  private readonly opts: ManagedConnectionOptions

  constructor(opts: ManagedConnectionOptions) {
    this.opts = opts
  }

  get state(): ConnectionState {
    return this._state
  }

  get deviceName(): string | undefined {
    return this.device?.name
  }

  onStateChange(cb: (state: ConnectionState) => void): Unsubscribe {
    return this.stateEmitter.on(cb)
  }

  /** 初回はデバイス選択ダイアログを出す（ユーザー操作の中から呼ぶこと）。 */
  async connect(): Promise<void> {
    if (this._state !== 'disconnected') return
    this.intentional = false
    this.setState('connecting')
    try {
      if (!this.device) {
        const dev = await this.opts.transport.requestDevice(this.opts.request)
        this.device = dev
        this.offDisconnected = this.opts.transport.onDisconnected(dev, () =>
          this.handleDisconnected(),
        )
      }
      await this.establish(this.device)
      this.setState('connected')
    } catch (e) {
      this.runCleanup()
      if (this.device) await this.opts.transport.disconnect(this.device).catch(() => {})
      this.setState('disconnected')
      throw e
    }
  }

  async disconnect(): Promise<void> {
    this.intentional = true
    this.cancelRetry()
    this.runCleanup()
    if (this.device) await this.opts.transport.disconnect(this.device).catch(() => {})
    this.setState('disconnected')
  }

  /** デバイスの選択を解除する。次の connect() で再度選択ダイアログを出す。 */
  async forget(): Promise<void> {
    await this.disconnect()
    this.offDisconnected?.()
    this.offDisconnected = null
    this.device = null
  }

  private async establish(dev: BleDeviceRef) {
    await this.opts.transport.connect(dev)
    this.cleanup = (await this.opts.setup(dev)) ?? null
  }

  private handleDisconnected() {
    // 初回接続中・意図的な切断・再接続中の切断は connect()/retry() 側で処理する
    if (this.intentional || this._state !== 'connected') return
    this.runCleanup()
    this.retryCount = 0
    this.setState('reconnecting')
    this.scheduleRetry()
  }

  private scheduleRetry() {
    const delays = this.opts.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS
    const maxRetries = this.opts.maxRetries ?? DEFAULT_MAX_RETRIES
    if (this.retryCount >= maxRetries) {
      this.setState('disconnected')
      return
    }
    const delayMs = delays[Math.min(this.retryCount, delays.length - 1)] ?? 0
    this.retryCount++
    this.retryTimer = setTimeout(() => void this.retry(), delayMs)
  }

  private async retry() {
    this.retryTimer = null
    const dev = this.device
    if (!dev || this.intentional) return
    try {
      await this.establish(dev)
      if (this.intentional) return
      this.setState('connected')
    } catch (e) {
      console.warn('再接続に失敗しました', e)
      this.runCleanup()
      if (this.intentional) return
      await this.opts.transport.disconnect(dev).catch(() => {})
      this.scheduleRetry()
    }
  }

  private cancelRetry() {
    if (this.retryTimer !== null) clearTimeout(this.retryTimer)
    this.retryTimer = null
  }

  private runCleanup() {
    const cleanup = this.cleanup
    this.cleanup = null
    try {
      cleanup?.()
    } catch (e) {
      console.warn(e)
    }
  }

  private setState(state: ConnectionState) {
    if (this._state === state) return
    this._state = state
    this.stateEmitter.emit(state)
  }
}
