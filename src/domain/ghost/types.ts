import type { RecordingDevice } from '../course/types.ts'

/** 実走記録の 1 点（ゴースト用） */
export interface ReferenceSample {
  /** 記録開始からの経過秒数 */
  timeS: number
  lat: number
  lon: number
  elevationM?: number
  powerW?: number
  heartRateBpm?: number
  cadenceRpm?: number
}

/** 取り込んだ実走記録（docs/02-architecture.md §3 の ReferenceRide） */
export interface ReferenceRide {
  id: string
  name: string
  fileName: string
  /** 記録開始時刻（Unix ms） */
  recordedAtMs: number
  device: RecordingDevice
  samples: ReferenceSample[]
  createdAt: number
}
