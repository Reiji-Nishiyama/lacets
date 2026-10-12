import type { Unsubscribe } from '../devices/emitter.ts'
import type { RideEngine, RideSnapshot, RideStatus } from '../ride/RideEngine.ts'
import { computeRideStats } from './rideStats.ts'
import type { RecordedRide, RideEvent, RideSample } from './types.ts'

export type RideRecorderMeta = Pick<
  RecordedRide,
  'id' | 'routeId' | 'routeName' | 'settings' | 'ghost' | 'reversed' | 'startDistanceM'
>

/**
 * RideEngine の記録ティック（約 1 秒ごと）からサンプルを集め、一時停止・再開をイベントとして残す。
 * 時刻は秒に丸め、同じ秒のサンプルは後のものだけ残す（FIT の timestamp は 1 秒分解能）。
 */
export class RideRecorder {
  private readonly samples: RideSample[] = []
  private readonly events: RideEvent[] = []
  private readonly unsubs: Unsubscribe[]
  private readonly meta: RideRecorderMeta
  private readonly now: () => number
  private lastStatus: RideStatus = 'ready'
  private startedAtMs: number | null = null

  constructor(engine: RideEngine, meta: RideRecorderMeta, now: () => number = Date.now) {
    this.meta = meta
    this.now = now
    this.unsubs = [
      engine.onRecordTick(({ snapshot }) => this.addSample(snapshot)),
      engine.onSnapshot((s) => this.handleStatus(s.status)),
    ]
  }

  get sampleCount(): number {
    return this.samples.length
  }

  /** 記録を締めて走行記録を返す。一度もタイマーが動いていなければ null */
  finish(): RecordedRide | null {
    for (const unsub of this.unsubs) unsub()
    if (this.startedAtMs === null) return null
    if (this.events[this.events.length - 1]?.type === 'start') this.addEvent('stop')
    const endedAtMs = Math.max(
      this.events[this.events.length - 1]?.timestampMs ?? this.startedAtMs,
      this.samples[this.samples.length - 1]?.timestampMs ?? this.startedAtMs,
    )
    return {
      ...this.meta,
      startedAtMs: this.startedAtMs,
      endedAtMs,
      samples: [...this.samples],
      events: [...this.events],
      stats: computeRideStats(
        this.samples,
        this.startedAtMs,
        endedAtMs,
        this.meta.startDistanceM ?? 0,
      ),
    }
  }

  private handleStatus(status: RideStatus) {
    if (status === this.lastStatus) return
    const wasRunning = this.lastStatus === 'running'
    this.lastStatus = status
    if (status === 'running' && !wasRunning) this.addEvent('start')
    else if (wasRunning) this.addEvent('stop')
  }

  private addEvent(type: RideEvent['type']) {
    const timestampMs = roundToSecond(this.now())
    if (this.startedAtMs === null) {
      if (type === 'stop') return
      this.startedAtMs = timestampMs
    }
    this.events.push({ timestampMs, type })
  }

  private addSample(s: RideSnapshot) {
    const timestampMs = roundToSecond(this.now())
    const sample: RideSample = {
      timestampMs,
      elapsedS: s.elapsedS,
      distanceM: s.distanceM,
      lat: s.position.lat,
      lon: s.position.lon,
      elevationM: s.position.elevationM,
      speedMps: s.speedMps,
      powerW: s.powerW,
      cadenceRpm: s.cadenceRpm,
      heartRateBpm: s.heartRateBpm,
      grade: s.position.grade,
    }
    if (this.samples[this.samples.length - 1]?.timestampMs === timestampMs) {
      this.samples[this.samples.length - 1] = sample
    } else {
      this.samples.push(sample)
    }
  }
}

function roundToSecond(ms: number): number {
  return Math.round(ms / 1000) * 1000
}
