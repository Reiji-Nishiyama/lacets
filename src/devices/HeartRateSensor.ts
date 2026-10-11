import type { ConnectionState } from './ConnectionState.ts'
import type { Unsubscribe } from './emitter.ts'

export interface HeartRateData {
  heartRateBpm: number
  timestampMs: number
}

/** 心拍計（任意）。実装は BleHeartRateSensor と SimulatedHeartRateSensor。 */
export interface HeartRateSensor {
  readonly kind: 'ble' | 'simulated'
  readonly state: ConnectionState
  readonly name: string | undefined
  connect(): Promise<void>
  disconnect(): Promise<void>
  onData(cb: (data: HeartRateData) => void): Unsubscribe
  onStateChange(cb: (state: ConnectionState) => void): Unsubscribe
}
