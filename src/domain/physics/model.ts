import { AIR_DENSITY_KG_PER_M3 } from './aero.ts'

/** 標準重力加速度 [m/s²] */
export const GRAVITY_MPS2 = 9.80665

export interface PhysicsParams {
  /** 体重 + バイク重量 [kg] */
  totalMassKg: number
  cdaM2: number
  crr: number
  airDensityKgPerM3: number
  /** 回転体（ホイール等）の慣性を質量に上乗せする割合 */
  rotationalInertiaRatio: number
  /** P/v の発散を防ぐ速度の下限 [m/s] */
  minSpeedMps: number
}

export const DEFAULT_PHYSICS: Omit<PhysicsParams, 'totalMassKg' | 'cdaM2' | 'crr'> = {
  airDensityKgPerM3: AIR_DENSITY_KG_PER_M3,
  rotationalInertiaRatio: 0.03,
  minSpeedMps: 0.5,
}

export interface MotionState {
  speedMps: number
  distanceM: number
}

/**
 * 進行方向の抵抗力 [N]（重力の坂方向成分 + 転がり抵抗 + 空気抵抗）。
 * windSpeedMps は向かい風を正とする。KICKR は駆動系の後で計測するため駆動損失は含めない。
 */
export function resistanceN(
  speedMps: number,
  grade: number,
  p: PhysicsParams,
  windSpeedMps = 0,
): number {
  const theta = Math.atan(grade)
  const weightN = p.totalMassKg * GRAVITY_MPS2
  const gravityN = weightN * Math.sin(theta)
  const rollingN = weightN * Math.cos(theta) * p.crr
  const airMps = speedMps + windSpeedMps
  const aeroN = 0.5 * p.airDensityKgPerM3 * p.cdaM2 * airMps * Math.abs(airMps)
  return gravityN + rollingN + aeroN
}

/** 加速度 [m/s²]: m_eff·dv/dt = P / max(v, v_min) − 抵抗 */
export function accelerationMps2(
  speedMps: number,
  powerW: number,
  grade: number,
  p: PhysicsParams,
  windSpeedMps = 0,
): number {
  const driveN = powerW > 0 ? powerW / Math.max(speedMps, p.minSpeedMps) : 0
  const effectiveMassKg = p.totalMassKg * (1 + p.rotationalInertiaRatio)
  return (driveN - resistanceN(speedMps, grade, p, windSpeedMps)) / effectiveMassKg
}

/** 内部の積分刻み [s] */
const MAX_SUBSTEP_S = 0.05

/**
 * dtS だけ速度と距離を進める（半陰的オイラー法、刻みは最大 0.05 s）。
 * 速度は 0 未満にしない（P = 0 の登りでは停止し、後ろには下がらない）。
 */
export function advance(
  state: MotionState,
  powerW: number,
  grade: number,
  dtS: number,
  p: PhysicsParams,
  windSpeedMps = 0,
): MotionState {
  if (dtS <= 0) return state
  let { speedMps, distanceM } = state
  const steps = Math.ceil(dtS / MAX_SUBSTEP_S)
  const h = dtS / steps
  for (let i = 0; i < steps; i++) {
    speedMps = Math.max(
      0,
      speedMps + accelerationMps2(speedMps, powerW, grade, p, windSpeedMps) * h,
    )
    distanceM += speedMps * h
  }
  return { speedMps, distanceM }
}

/** 一定のパワー・勾配で釣り合う速度 [m/s]（二分法）。登りで P = 0 なら 0 */
export function steadySpeedMps(
  powerW: number,
  grade: number,
  p: PhysicsParams,
  windSpeedMps = 0,
): number {
  // f(v) = v·抵抗(v) − P は v = 0 で −P ≤ 0、十分大きい v で正。符号が変わる点を探す
  const f = (v: number) => v * resistanceN(v, grade, p, windSpeedMps) - Math.max(0, powerW)
  let lo = 0
  let hi = 50
  if (f(hi) < 0) return hi
  if (powerW <= 0 && resistanceN(0, grade, p, windSpeedMps) >= 0) return 0
  // 下りで P = 0 のとき v = 0 も根になるので、抵抗が負（加速する）側から探す
  if (powerW <= 0) lo = 1e-6
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2
    if (f(mid) < 0) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}
