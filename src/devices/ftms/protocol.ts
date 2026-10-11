/**
 * Fitness Machine Service（FTMS v1.0）のバイト列エンコード/デコード。
 * ブラウザ API に依存しない純粋関数のみを置く。値は SI 単位（勾配は小数）で受け渡す。
 * 仕様の要点は docs/05-ble-ftms.md を参照。
 */

import type { GradeRange, SimulationParams } from '../TrainerDevice.ts'

export const OpCode = {
  RequestControl: 0x00,
  Reset: 0x01,
  StartOrResume: 0x07,
  StopOrPause: 0x08,
  SetIndoorBikeSimulation: 0x11,
  ResponseCode: 0x80,
} as const
export type OpCode = (typeof OpCode)[keyof typeof OpCode]

export const ResultCode = {
  Success: 0x01,
  OpCodeNotSupported: 0x02,
  InvalidParameter: 0x03,
  OperationFailed: 0x04,
  ControlNotPermitted: 0x05,
} as const
export type ResultCode = (typeof ResultCode)[keyof typeof ResultCode]

export function resultCodeName(code: number): string {
  for (const [name, value] of Object.entries(ResultCode)) {
    if (value === code) return name
  }
  return `Unknown(0x${code.toString(16).padStart(2, '0')})`
}

const SINT16_MIN = -0x8000
const SINT16_MAX = 0x7fff
const UINT8_MAX = 0xff

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)))
}

// ---------------------------------------------------------------------------
// Control Point（0x2AD9）への書き込み
// ---------------------------------------------------------------------------

export function encodeRequestControl(): Uint8Array {
  return Uint8Array.of(OpCode.RequestControl)
}

export function encodeReset(): Uint8Array {
  return Uint8Array.of(OpCode.Reset)
}

export function encodeStartOrResume(): Uint8Array {
  return Uint8Array.of(OpCode.StartOrResume)
}

/** Stop or Pause。パラメータ 0x01 = Stop、0x02 = Pause。 */
export function encodeStopOrPause(kind: 'stop' | 'pause'): Uint8Array {
  return Uint8Array.of(OpCode.StopOrPause, kind === 'stop' ? 0x01 : 0x02)
}

/**
 * Set Indoor Bike Simulation Parameters（0x11）。
 * Wind Speed sint16 (0.001 m/s) / Grade sint16 (0.01 %) / Crr uint8 (0.0001) / Cw uint8 (0.01 kg/m)。
 * 各フィールドの表現範囲を超える値はクランプする。
 */
export function encodeSetSimulation(params: SimulationParams): Uint8Array {
  const wind = clampInt(params.windSpeedMps * 1000, SINT16_MIN, SINT16_MAX)
  const grade = clampInt(params.grade * 10_000, SINT16_MIN, SINT16_MAX)
  const crr = clampInt(params.crr * 10_000, 0, UINT8_MAX)
  const cw = clampInt(params.cwKgPerM * 100, 0, UINT8_MAX)
  const buf = new Uint8Array(7)
  const view = new DataView(buf.buffer)
  view.setUint8(0, OpCode.SetIndoorBikeSimulation)
  view.setInt16(1, wind, true)
  view.setInt16(3, grade, true)
  view.setUint8(5, crr)
  view.setUint8(6, cw)
  return buf
}

// ---------------------------------------------------------------------------
// Control Point の応答（indicate）
// ---------------------------------------------------------------------------

export interface ControlPointResponse {
  requestOpCode: number
  resultCode: number
}

/** `[0x80, 要求 opcode, 結果コード, ...]` を解釈する。応答でなければ null。 */
export function decodeControlPointResponse(view: DataView): ControlPointResponse | null {
  if (view.byteLength < 3 || view.getUint8(0) !== OpCode.ResponseCode) return null
  return { requestOpCode: view.getUint8(1), resultCode: view.getUint8(2) }
}

// ---------------------------------------------------------------------------
// Indoor Bike Data（0x2AD2, notify）
// ---------------------------------------------------------------------------

export interface IndoorBikeData {
  /** トレーナーが報告する速度 [m/s]。フライホイール由来のため走行計算には使わない */
  speedMps?: number
  averageSpeedMps?: number
  cadenceRpm?: number
  averageCadenceRpm?: number
  totalDistanceM?: number
  resistanceLevel?: number
  powerW?: number
  averagePowerW?: number
  totalEnergyKcal?: number
  heartRateBpm?: number
  elapsedTimeS?: number
  remainingTimeS?: number
}

const KMH_TO_MPS = 1000 / 3600

/**
 * フラグを下位ビットから順に見て、存在するフィールドだけオフセットを進めて読む。
 * 途中でデータが尽きた場合（切り詰められたパケット）は、そこまでに読めた値を返す。
 */
export function decodeIndoorBikeData(view: DataView): IndoorBikeData {
  const out: IndoorBikeData = {}
  if (view.byteLength < 2) return out
  const flags = view.getUint16(0, true)
  let offset = 2
  const has = (bit: number) => (flags & (1 << bit)) !== 0
  const avail = (size: number) => offset + size <= view.byteLength

  // bit0 More Data: 0 のとき Instantaneous Speed が存在する（反転論理）
  if (!has(0)) {
    if (!avail(2)) return out
    out.speedMps = view.getUint16(offset, true) * 0.01 * KMH_TO_MPS
    offset += 2
  }
  if (has(1)) {
    if (!avail(2)) return out
    out.averageSpeedMps = view.getUint16(offset, true) * 0.01 * KMH_TO_MPS
    offset += 2
  }
  if (has(2)) {
    if (!avail(2)) return out
    out.cadenceRpm = view.getUint16(offset, true) * 0.5
    offset += 2
  }
  if (has(3)) {
    if (!avail(2)) return out
    out.averageCadenceRpm = view.getUint16(offset, true) * 0.5
    offset += 2
  }
  if (has(4)) {
    if (!avail(3)) return out
    out.totalDistanceM = view.getUint16(offset, true) + (view.getUint8(offset + 2) << 16)
    offset += 3
  }
  if (has(5)) {
    if (!avail(2)) return out
    out.resistanceLevel = view.getInt16(offset, true)
    offset += 2
  }
  if (has(6)) {
    if (!avail(2)) return out
    out.powerW = view.getInt16(offset, true)
    offset += 2
  }
  if (has(7)) {
    if (!avail(2)) return out
    out.averagePowerW = view.getInt16(offset, true)
    offset += 2
  }
  if (has(8)) {
    // Total Energy uint16 / Energy per Hour uint16 / Energy per Minute uint8
    if (!avail(5)) return out
    out.totalEnergyKcal = view.getUint16(offset, true)
    offset += 5
  }
  if (has(9)) {
    if (!avail(1)) return out
    out.heartRateBpm = view.getUint8(offset)
    offset += 1
  }
  if (has(10)) {
    // Metabolic Equivalent uint8（未使用、読み飛ばす）
    if (!avail(1)) return out
    offset += 1
  }
  if (has(11)) {
    if (!avail(2)) return out
    out.elapsedTimeS = view.getUint16(offset, true)
    offset += 2
  }
  if (has(12)) {
    if (!avail(2)) return out
    out.remainingTimeS = view.getUint16(offset, true)
    offset += 2
  }
  // bit13 以降は未定義（RFU）。未知のフラグがあっても無視する
  return out
}

// ---------------------------------------------------------------------------
// Fitness Machine Feature（0x2ACC, read）
// ---------------------------------------------------------------------------

export interface FtmsFeatures {
  cadenceSupported: boolean
  powerMeasurementSupported: boolean
  heartRateMeasurementSupported: boolean
  indoorBikeSimulationSupported: boolean
}

/** 先頭 uint32 = Fitness Machine Features、続く uint32 = Target Setting Features。 */
export function decodeFeatures(view: DataView): FtmsFeatures {
  const machine = view.byteLength >= 4 ? view.getUint32(0, true) : 0
  const target = view.byteLength >= 8 ? view.getUint32(4, true) : 0
  return {
    cadenceSupported: (machine & (1 << 1)) !== 0,
    heartRateMeasurementSupported: (machine & (1 << 10)) !== 0,
    powerMeasurementSupported: (machine & (1 << 14)) !== 0,
    indoorBikeSimulationSupported: (target & (1 << 13)) !== 0,
  }
}

// ---------------------------------------------------------------------------
// Supported Inclination Range（0x2AD5, read）
// ---------------------------------------------------------------------------

/** Minimum sint16 / Maximum sint16 / Minimum Increment uint16。いずれも 0.1 % 単位。 */
export function decodeInclinationRange(view: DataView): GradeRange | null {
  if (view.byteLength < 4) return null
  return {
    minGrade: view.getInt16(0, true) / 1000,
    maxGrade: view.getInt16(2, true) / 1000,
  }
}

// ---------------------------------------------------------------------------
// Fitness Machine Status（0x2ADA, notify）
// ---------------------------------------------------------------------------

export const StatusOpCode = {
  Reset: 0x01,
  StoppedOrPausedByUser: 0x02,
  StartedOrResumedByUser: 0x04,
  IndoorBikeSimulationChanged: 0x12,
  ControlPermissionLost: 0xff,
} as const

export function decodeStatusOpCode(view: DataView): number | null {
  return view.byteLength >= 1 ? view.getUint8(0) : null
}
