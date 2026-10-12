import type { Course, CoursePosition } from '../domain/course/Course.ts'
import { cwFromCda } from '../domain/physics/aero.ts'
import type { PhysicsParams } from '../domain/physics/model.ts'
import { GradeThrottle, trainerGrade } from '../domain/ride/gradeCommand.ts'
import { INITIAL_PROGRESS, stepRide, type RideProgress } from '../domain/ride/rideStep.ts'
import { physicsParamsFor, type RiderSettings } from '../domain/rider.ts'
import { Emitter, type Unsubscribe } from '../devices/emitter.ts'
import type { ConnectionState } from '../devices/ConnectionState.ts'
import type { HeartRateSensor } from '../devices/HeartRateSensor.ts'
import type { TrainerData, TrainerDevice } from '../devices/TrainerDevice.ts'

/**
 * - ready: 開始前
 * - running: 走行中
 * - paused: ユーザーが一時停止
 * - autoPaused: トレーナーが切断され自動で一時停止（再接続で自動再開）
 * - finished: 終点到達またはユーザーが終了
 */
export type RideStatus = 'ready' | 'running' | 'paused' | 'autoPaused' | 'finished'

export interface RideSnapshot {
  status: RideStatus
  elapsedS: number
  /** ルート上の位置 */
  distanceM: number
  /** 走り始めてから進んだ距離（ルートの途中から走った場合は distanceM と異なる） */
  travelledM: number
  remainingM: number
  speedMps: number
  powerW: number
  cadenceRpm: number | null
  heartRateBpm: number | null
  position: CoursePosition
  /** トレーナーに最後に送った勾配（難易度適用後） */
  trainerGrade: number | null
}

/** 1 秒ごとの記録用のティック（M2 3/3 で記録・FIT 出力に使う） */
export interface RideTick {
  snapshot: RideSnapshot
  dtS: number
}

export interface RideEngineOptions {
  course: Course
  trainer: TrainerDevice
  heartRate?: HeartRateSensor | null
  settings: RiderSettings
  /** 走り始めるルート上の距離（#5）。既定は始点 */
  startDistanceM?: number
  /** 走行ループの間隔 [ms]（4 Hz） */
  tickMs?: number
  /** これより古いパワーは 0 とみなす [ms] */
  staleDataMs?: number
  now?: () => number
}

/** タブが裏に回ってタイマーが間引かれても、1 回で進める時間の上限 [s] */
const MAX_DT_S = 2

/**
 * 走行ループ（docs/02-architecture.md §4）。パワー → 物理モデル → 距離の積分、
 * lookahead 付きの勾配指令（間引き付き）を 4 Hz で回す。
 */
export class RideEngine {
  private readonly course: Course
  private readonly trainer: TrainerDevice
  private readonly heartRate: HeartRateSensor | null
  private readonly settings: RiderSettings
  private readonly physics: PhysicsParams
  private readonly tickMs: number
  private readonly startDistanceM: number
  private readonly staleDataMs: number
  private readonly now: () => number
  private readonly throttle = new GradeThrottle()
  private readonly snapshotEmitter = new Emitter<RideSnapshot>()
  private readonly tickEmitter = new Emitter<RideTick>()
  private readonly unsubs: Unsubscribe[] = []

  private status: RideStatus = 'ready'
  private progress: RideProgress = INITIAL_PROGRESS
  private latestTrainer: TrainerData | null = null
  private trainerReceivedMs = -Infinity
  private latestHeartRateBpm: number | null = null
  private latestHeartRateMs = -Infinity
  private lastSentGrade: number | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private lastTickMs = 0
  /** 前回の記録ティックからの経過 [s] */
  private recordAccumS = 0

  constructor(opts: RideEngineOptions) {
    this.course = opts.course
    this.trainer = opts.trainer
    this.heartRate = opts.heartRate ?? null
    this.settings = opts.settings
    this.physics = physicsParamsFor(opts.settings)
    this.tickMs = opts.tickMs ?? 250
    this.startDistanceM = Math.min(
      Math.max(0, opts.startDistanceM ?? 0),
      Math.max(0, this.course.distanceM - 1),
    )
    this.progress = { ...INITIAL_PROGRESS, distanceM: this.startDistanceM }
    this.staleDataMs = opts.staleDataMs ?? 2000
    this.now = opts.now ?? (() => performance.now())

    this.unsubs.push(
      this.trainer.onData((d) => {
        this.latestTrainer = d
        this.trainerReceivedMs = this.now()
      }),
      this.trainer.onStateChange((s) => this.handleTrainerState(s)),
    )
    if (this.heartRate) {
      this.unsubs.push(
        this.heartRate.onData((d) => {
          this.latestHeartRateBpm = d.heartRateBpm
          this.latestHeartRateMs = this.now()
        }),
      )
    }
  }

  get snapshot(): RideSnapshot {
    const nowMs = this.now()
    const trainerFresh = nowMs - this.trainerReceivedMs < this.staleDataMs
    const hrFresh = nowMs - this.latestHeartRateMs < this.staleDataMs * 2
    const active = this.status === 'running'
    return {
      status: this.status,
      elapsedS: this.progress.elapsedS,
      distanceM: this.progress.distanceM,
      travelledM: this.progress.distanceM - this.startDistanceM,
      remainingM: Math.max(0, this.course.distanceM - this.progress.distanceM),
      speedMps: this.progress.speedMps,
      powerW: active && trainerFresh ? (this.latestTrainer?.powerW ?? 0) : 0,
      cadenceRpm: active && trainerFresh ? (this.latestTrainer?.cadenceRpm ?? null) : null,
      heartRateBpm: hrFresh
        ? this.latestHeartRateBpm
        : trainerFresh
          ? (this.latestTrainer?.heartRateBpm ?? null)
          : null,
      position: this.course.positionAt(this.progress.distanceM),
      trainerGrade: this.lastSentGrade,
    }
  }

  onSnapshot(cb: (s: RideSnapshot) => void): Unsubscribe {
    return this.snapshotEmitter.on(cb)
  }

  /** 走行中の 1 秒ごとの記録タイミング */
  onRecordTick(cb: (t: RideTick) => void): Unsubscribe {
    return this.tickEmitter.on(cb)
  }

  start(): void {
    if (this.status !== 'ready') return
    this.lastTickMs = this.now()
    this.timer = setInterval(() => this.tick(), this.tickMs)
    this.enterActive()
  }

  pause(): void {
    if (this.status !== 'running' && this.status !== 'autoPaused') return
    this.progress = { ...this.progress, speedMps: 0 }
    this.setStatus('paused')
  }

  resume(): void {
    if (this.status !== 'paused') return
    this.lastTickMs = this.now()
    this.enterActive()
  }

  /** ユーザーによる途中終了 */
  finish(): void {
    if (this.status === 'ready' || this.status === 'finished') return
    this.stopTimer()
    this.setStatus('finished')
  }

  dispose(): void {
    this.stopTimer()
    for (const unsub of this.unsubs) unsub()
    this.snapshotEmitter.clear()
    this.tickEmitter.clear()
  }

  // -------------------------------------------------------------------------

  /** トレーナーが接続中なら走行、そうでなければ再接続待ちの自動一時停止にする */
  private enterActive() {
    const connected = this.trainer.state === 'connected'
    this.setStatus(connected ? 'running' : 'autoPaused')
    if (connected) this.sendGrade(true)
  }

  private handleTrainerState(state: ConnectionState) {
    if (state !== 'connected' && this.status === 'running') {
      this.progress = { ...this.progress, speedMps: 0 }
      this.setStatus('autoPaused')
    } else if (state === 'connected' && this.status === 'autoPaused') {
      this.lastTickMs = this.now()
      this.enterActive()
    }
  }

  private tick() {
    const nowMs = this.now()
    const dtS = Math.min(MAX_DT_S, Math.max(0, (nowMs - this.lastTickMs) / 1000))
    this.lastTickMs = nowMs
    if (this.status === 'running') {
      const powerW = this.snapshot.powerW
      this.progress = stepRide(this.progress, powerW, dtS, this.course, this.physics)
      this.recordAccumS += dtS
      if (this.recordAccumS >= 1 || this.progress.finished) {
        this.tickEmitter.emit({ snapshot: this.snapshot, dtS: this.recordAccumS })
        this.recordAccumS = 0
      }
      if (this.progress.finished) {
        this.stopTimer()
        this.setStatus('finished')
        return
      }
      this.sendGrade(false)
    }
    this.snapshotEmitter.emit(this.snapshot)
  }

  private sendGrade(force: boolean) {
    const grade = trainerGrade(
      this.course,
      this.progress.distanceM,
      this.progress.speedMps,
      this.settings.difficulty,
    )
    if (force) this.throttle.reset()
    if (!this.throttle.shouldSend(grade, this.now())) return
    this.lastSentGrade = grade
    this.trainer
      .setSimulation({
        windSpeedMps: 0,
        grade,
        crr: this.physics.crr,
        cwKgPerM: cwFromCda(this.physics.cdaM2, this.physics.airDensityKgPerM3),
      })
      .catch((e: unknown) => console.warn('勾配の送信に失敗しました', e))
  }

  private stopTimer() {
    if (this.timer !== null) clearInterval(this.timer)
    this.timer = null
  }

  private setStatus(status: RideStatus) {
    if (this.status === status) return
    this.status = status
    this.snapshotEmitter.emit(this.snapshot)
  }
}
