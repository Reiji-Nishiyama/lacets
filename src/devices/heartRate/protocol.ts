/** Heart Rate Measurement（0x2A37）のデコード。純粋関数。 */

export interface HeartRateMeasurement {
  heartRateBpm: number
  /** RR 間隔 [s]（センサーが送る場合のみ） */
  rrIntervalsS: number[]
}

/**
 * Flags uint8: bit0 = 心拍値の形式（0: uint8, 1: uint16）、bit1-2 = 接触検知、
 * bit3 = Energy Expended（uint16）あり、bit4 = RR-Interval（uint16, 1/1024 s の列）あり。
 */
export function decodeHeartRateMeasurement(view: DataView): HeartRateMeasurement | null {
  if (view.byteLength < 2) return null
  const flags = view.getUint8(0)
  let offset = 1
  let heartRateBpm: number
  if (flags & 0x01) {
    if (view.byteLength < 3) return null
    heartRateBpm = view.getUint16(offset, true)
    offset += 2
  } else {
    heartRateBpm = view.getUint8(offset)
    offset += 1
  }
  if (flags & 0x08) offset += 2
  const rrIntervalsS: number[] = []
  if (flags & 0x10) {
    while (offset + 2 <= view.byteLength) {
      rrIntervalsS.push(view.getUint16(offset, true) / 1024)
      offset += 2
    }
  }
  return { heartRateBpm, rrIntervalsS }
}
