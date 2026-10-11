import { detectFeatures } from '../../platform/features.ts'
import type { BleTransport } from './BleTransport.ts'
import { WebBluetoothTransport } from './WebBluetoothTransport.ts'

/**
 * 実行環境に合った BleTransport を返す。使えない環境では null。
 * M7 で Capacitor 環境なら CapacitorBleTransport を返すようにする。
 */
export function createBleTransport(): BleTransport | null {
  if (detectFeatures().webBluetooth) return new WebBluetoothTransport()
  return null
}
