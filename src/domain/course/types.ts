/** 取り込んだファイルの生の点。 */
export interface RoutePoint {
  lat: number
  lon: number
  elevationM?: number
  /** 最初の時刻付きの点からの経過秒数（実走データのみ） */
  timeS?: number
}

/**
 * 標高の由来。平滑化の強さを変えるために使う（docs/02-architecture.md §6）。
 * - barometric: 実走 FIT の気圧高度（精度が高いので軽く平滑化）
 * - dem: ルート作成サービスが DEM から付けた標高（段差やノイズが多いので強く平滑化）
 */
export type ElevationSource = 'barometric' | 'dem'

export type RouteFormat = 'gpx' | 'tcx' | 'fit'

/** 実走記録に含まれるセンサー値（ゴーストの比較に使う。ルートとしては保存しない） */
export interface SensorValues {
  powerW?: number
  heartRateBpm?: number
  cadenceRpm?: number
}

export type ParsedPoint = RoutePoint & SensorValues

/** 記録した機器のメーカー（FIT の file_id から判定） */
export type RecordingDevice = 'wahoo' | 'garmin' | 'other'

export interface ParsedRoute {
  format: RouteFormat
  name: string | undefined
  points: ParsedPoint[]
  elevationSource: ElevationSource
  /** 最初の時刻付きの点の時刻（Unix ms）。あれば実走記録 */
  startedAtMs?: number
  device?: RecordingDevice
}

/** 走行用に等間隔へ再サンプルした点。 */
export interface ProfilePoint {
  distanceM: number
  lat: number
  lon: number
  elevationM: number
  /** この点での勾配（小数） */
  grade: number
}

export interface CourseStats {
  distanceM: number
  ascentM: number
  descentM: number
  maxGrade: number
  minGrade: number
}
