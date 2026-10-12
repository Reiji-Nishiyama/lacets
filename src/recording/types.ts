import type { RiderSettings } from '../domain/rider.ts'

/** 1 Hz の記録サンプル（F4-1） */
export interface RideSample {
  /** 実時刻（Unix ms、秒に丸めたもの） */
  timestampMs: number
  /** 走行時間（一時停止を除く）[s] */
  elapsedS: number
  distanceM: number
  /** 仮想ルート上の位置 */
  lat: number
  lon: number
  elevationM: number
  speedMps: number
  powerW: number
  cadenceRpm: number | null
  heartRateBpm: number | null
  grade: number
}

/** タイマーの開始・停止（一時停止と再開） */
export interface RideEvent {
  timestampMs: number
  type: 'start' | 'stop'
}

export interface RideStats {
  /** 走行時間（一時停止を除く）[s] */
  movingTimeS: number
  /** 開始から終了までの実時間 [s] */
  elapsedWallS: number
  distanceM: number
  ascentM: number
  averagePowerW: number
  maxPowerW: number
  averageSpeedMps: number
  maxSpeedMps: number
  averageCadenceRpm: number | null
  averageHeartRateBpm: number | null
  maxHeartRateBpm: number | null
}

/** ゴーストの参照先: 実走データ（ReferenceRide）か、Lacets の過去の走行 */
export interface GhostRef {
  kind: 'reference' | 'ride'
  id: string
}

/** 端末内に保存する走行記録（docs/02-architecture.md §3 の Ride） */
export interface RecordedRide {
  id: string
  routeId: string
  routeName: string
  startedAtMs: number
  endedAtMs: number
  samples: RideSample[]
  events: RideEvent[]
  stats: RideStats
  /** 走行時点の設定のスナップショット */
  settings: RiderSettings
  /** 走行中に比べたゴースト */
  ghost?: GhostRef & { name: string }
}
