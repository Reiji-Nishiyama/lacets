import type { BleDeviceRef, BleTransport } from '../ble/BleTransport.ts'
import { BleNotFoundError } from '../ble/BleTransport.ts'
import { ManagedConnection } from '../ble/ManagedConnection.ts'
import {
  CYCLING_POWER_SERVICE,
  FTMS_CONTROL_POINT,
  FTMS_FEATURE,
  FTMS_SERVICE,
  FTMS_STATUS,
  HEART_RATE_SERVICE,
  INDOOR_BIKE_DATA,
  SUPPORTED_INCLINATION_RANGE,
} from '../ble/uuids.ts'
import type { ConnectionState } from '../ConnectionState.ts'
import { Emitter, type Unsubscribe } from '../emitter.ts'
import {
  clampGrade,
  type GradeRange,
  type SimulationParams,
  type TrainerCapabilities,
  type TrainerData,
  type TrainerDevice,
} from '../TrainerDevice.ts'
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
  OpCode,
  ResultCode,
  resultCodeName,
  StatusOpCode,
} from './protocol.ts'

/** Supported Inclination Range が読めない場合のクランプ範囲。ルート側の上限（±25%）に合わせる */
export const DEFAULT_GRADE_RANGE: GradeRange = { minGrade: -0.25, maxGrade: 0.25 }

export class FtmsCommandError extends Error {
  override name = 'FtmsCommandError'
  readonly opCode: number
  readonly resultCode: number | null

  constructor(opCode: number, resultCode: number | null, message: string) {
    super(message)
    this.opCode = opCode
    this.resultCode = resultCode
  }
}

export interface FtmsTrainerOptions {
  /** Control Point の応答待ちタイムアウト [ms] */
  responseTimeoutMs?: number
  now?: () => number
}

interface PendingResponse {
  opCode: number
  resolve: (resultCode: number) => void
  reject: (e: Error) => void
  timer: ReturnType<typeof setTimeout>
}

/**
 * Bluetooth FTMS のスマートトレーナー。プロトコル処理はここだけに書き、BLE 通信は BleTransport に任せる。
 * Control Point の書き込みはキューで直列化し、前の応答を待ってから次を送る（docs/05-ble-ftms.md）。
 */
export class FtmsTrainer implements TrainerDevice {
  readonly kind = 'ftms'
  private readonly conn: ManagedConnection
  private readonly dataEmitter = new Emitter<TrainerData>()
  private readonly responseTimeoutMs: number
  private readonly now: () => number
  private device: BleDeviceRef | null = null
  private _capabilities: TrainerCapabilities | null = null
  private pending: PendingResponse | null = null
  private queue: Promise<unknown> = Promise.resolve()
  private lastSimulation: SimulationParams | null = null
  /** キューに積まれ、まだ送信されていない勾配指令。間引きに使う */
  private queuedSimulation: Promise<void> | null = null

  private readonly transport: BleTransport

  constructor(transport: BleTransport, opts: FtmsTrainerOptions = {}) {
    this.transport = transport
    this.responseTimeoutMs = opts.responseTimeoutMs ?? 3000
    this.now = opts.now ?? Date.now
    this.conn = new ManagedConnection({
      transport,
      request: {
        services: [FTMS_SERVICE],
        optionalServices: [CYCLING_POWER_SERVICE, HEART_RATE_SERVICE],
      },
      setup: (dev) => this.setup(dev),
    })
  }

  get state(): ConnectionState {
    return this.conn.state
  }

  get name(): string | undefined {
    return this.conn.deviceName
  }

  get capabilities(): TrainerCapabilities | null {
    return this._capabilities
  }

  connect(): Promise<void> {
    return this.conn.connect()
  }

  async disconnect(): Promise<void> {
    if (this.conn.state === 'connected') {
      await this.enqueue(() => this.sendCommand(encodeStopOrPause('stop'))).catch((e) =>
        console.warn('Stop に失敗しました', e),
      )
    }
    await this.conn.disconnect()
  }

  onData(cb: (data: TrainerData) => void): Unsubscribe {
    return this.dataEmitter.on(cb)
  }

  onStateChange(cb: (state: ConnectionState) => void): Unsubscribe {
    return this.conn.onStateChange(cb)
  }

  setSimulation(params: SimulationParams): Promise<void> {
    this.lastSimulation = params
    if (this.conn.state !== 'connected') return Promise.resolve()
    if (this.queuedSimulation) return this.queuedSimulation
    const sent = this.enqueue(async () => {
      this.queuedSimulation = null
      await this.sendSimulation()
    })
    this.queuedSimulation = sent
    return sent
  }

  // -------------------------------------------------------------------------

  private async setup(dev: BleDeviceRef): Promise<() => void> {
    this.device = dev
    const unsubs: (() => void)[] = []
    const cleanup = () => {
      for (const unsub of unsubs) unsub()
      this.rejectPending(new FtmsCommandError(-1, null, '切断されました'))
      this.queuedSimulation = null
    }
    try {
      this._capabilities = await this.readCapabilities(dev)
      // 応答を取りこぼさないよう、Control Point の indicate を先に購読する
      unsubs.push(
        await this.transport.subscribe(dev, FTMS_SERVICE, FTMS_CONTROL_POINT, (v) =>
          this.handleControlPoint(v),
        ),
      )
      unsubs.push(
        await this.transport.subscribe(dev, FTMS_SERVICE, INDOOR_BIKE_DATA, (v) =>
          this.handleIndoorBikeData(v),
        ),
      )
      try {
        unsubs.push(
          await this.transport.subscribe(dev, FTMS_SERVICE, FTMS_STATUS, (v) =>
            this.handleStatus(v),
          ),
        )
      } catch (e) {
        if (!(e instanceof BleNotFoundError)) throw e
      }
      await this.enqueue(() => this.sendCommand(encodeRequestControl()))
      await this.enqueue(() => this.sendCommand(encodeStartOrResume()))
      // 再接続時は直前の勾配を送り直す
      if (this.lastSimulation) await this.enqueue(() => this.sendSimulation())
    } catch (e) {
      cleanup()
      throw e
    }
    return cleanup
  }

  private async readCapabilities(dev: BleDeviceRef): Promise<TrainerCapabilities> {
    let simulationSupported = true
    try {
      simulationSupported = decodeFeatures(
        await this.transport.read(dev, FTMS_SERVICE, FTMS_FEATURE),
      ).indoorBikeSimulationSupported
    } catch (e) {
      if (!(e instanceof BleNotFoundError)) throw e
    }
    let gradeRange = DEFAULT_GRADE_RANGE
    try {
      gradeRange =
        decodeInclinationRange(
          await this.transport.read(dev, FTMS_SERVICE, SUPPORTED_INCLINATION_RANGE),
        ) ?? DEFAULT_GRADE_RANGE
    } catch (e) {
      if (!(e instanceof BleNotFoundError)) throw e
    }
    return { gradeRange, simulationSupported }
  }

  private sendSimulation(): Promise<void> {
    const params = this.lastSimulation
    if (!params) return Promise.resolve()
    const range = this._capabilities?.gradeRange ?? DEFAULT_GRADE_RANGE
    return this.sendCommand(
      encodeSetSimulation({ ...params, grade: clampGrade(params.grade, range) }),
    )
  }

  /** Control Point の操作をキューの末尾に積む。前の操作が失敗しても後続は実行する。 */
  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn)
    this.queue = run.catch(() => {})
    return run
  }

  /**
   * コマンドを書き込み、応答を待つ。Control Not Permitted なら Request Control からやり直す（1 回まで）。
   * キューの中から呼ぶこと。
   */
  private async sendCommand(bytes: Uint8Array, retried = false): Promise<void> {
    const opCode = bytes[0] ?? -1
    const result = await this.writeAndWait(bytes)
    if (result === ResultCode.Success) return
    if (result === ResultCode.ControlNotPermitted && !retried && opCode !== OpCode.RequestControl) {
      console.warn('Control Not Permitted。Request Control からやり直します')
      await this.sendCommand(encodeRequestControl(), true)
      return this.sendCommand(bytes, true)
    }
    const message = `FTMS コマンド 0x${opCode.toString(16)} が失敗しました: ${resultCodeName(result)}`
    console.warn(message)
    throw new FtmsCommandError(opCode, result, message)
  }

  private writeAndWait(bytes: Uint8Array): Promise<number> {
    const dev = this.device
    const opCode = bytes[0] ?? -1
    if (!dev) return Promise.reject(new FtmsCommandError(opCode, null, '未接続です'))
    return new Promise<number>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending = null
        reject(
          new FtmsCommandError(
            opCode,
            null,
            `FTMS コマンド 0x${opCode.toString(16)} の応答がありません`,
          ),
        )
      }, this.responseTimeoutMs)
      this.pending = { opCode, resolve, reject, timer }
      this.transport.write(dev, FTMS_SERVICE, FTMS_CONTROL_POINT, bytes).catch((e: unknown) => {
        this.rejectPending(e instanceof Error ? e : new Error(String(e)))
      })
    })
  }

  private rejectPending(e: Error) {
    const p = this.pending
    if (!p) return
    this.pending = null
    clearTimeout(p.timer)
    p.reject(e)
  }

  private handleControlPoint(view: DataView) {
    const res = decodeControlPointResponse(view)
    const p = this.pending
    if (!res || !p || res.requestOpCode !== p.opCode) return
    this.pending = null
    clearTimeout(p.timer)
    p.resolve(res.resultCode)
  }

  private handleIndoorBikeData(view: DataView) {
    const d = decodeIndoorBikeData(view)
    this.dataEmitter.emit({
      powerW: d.powerW ?? 0,
      cadenceRpm: d.cadenceRpm,
      heartRateBpm: d.heartRateBpm,
      timestampMs: this.now(),
    })
  }

  private handleStatus(view: DataView) {
    if (decodeStatusOpCode(view) !== StatusOpCode.ControlPermissionLost) return
    console.warn('トレーナーの制御権が失われました。取り直します')
    this.enqueue(async () => {
      await this.sendCommand(encodeRequestControl())
      await this.sendCommand(encodeStartOrResume())
      await this.sendSimulation()
    }).catch((e) => console.warn('制御権の再取得に失敗しました', e))
  }
}
