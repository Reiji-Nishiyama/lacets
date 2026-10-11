import {
  FTMS_CONTROL_POINT,
  FTMS_FEATURE,
  FTMS_SERVICE,
  FTMS_STATUS,
  INDOOR_BIKE_DATA,
  SUPPORTED_INCLINATION_RANGE,
} from '../../src/devices/ble/uuids.ts'
import { FakeBleTransport } from './FakeBleTransport.ts'

export interface FakeFtmsOptions {
  /** opcode ごとの結果コードを返す。既定は常に Success（0x01） */
  resultFor?: (opCode: number, bytes: Uint8Array) => number | null
  withInclinationRange?: boolean
}

/** FTMS トレーナー（KICKR 相当）を模擬する FakeBleTransport を作る。 */
export function createFakeFtms(opts: FakeFtmsOptions = {}): FakeBleTransport {
  const t = new FakeBleTransport()
  // machine: cadence(bit1) + power(bit14), target: sim(bit13)
  t.addCharacteristic(FTMS_SERVICE, FTMS_FEATURE, Uint8Array.of(0x02, 0x40, 0, 0, 0, 0x20, 0, 0))
  if (opts.withInclinationRange ?? true) {
    // -10.0% 〜 +20.0%
    t.addCharacteristic(
      FTMS_SERVICE,
      SUPPORTED_INCLINATION_RANGE,
      Uint8Array.of(0x9c, 0xff, 0xc8, 0x00, 0x01, 0x00),
    )
  }
  t.addCharacteristic(FTMS_SERVICE, INDOOR_BIKE_DATA)
  t.addCharacteristic(FTMS_SERVICE, FTMS_STATUS)
  t.addCharacteristic(FTMS_SERVICE, FTMS_CONTROL_POINT)
  t.onWrite = (service, char, bytes) => {
    if (service !== FTMS_SERVICE || char !== FTMS_CONTROL_POINT) return
    const opCode = bytes[0] ?? 0
    const result = opts.resultFor ? opts.resultFor(opCode, bytes) : 0x01
    if (result === null) return // 応答しない
    t.notify(FTMS_SERVICE, FTMS_CONTROL_POINT, [0x80, opCode, result])
  }
  return t
}
