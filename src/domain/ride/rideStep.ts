import type { Course } from '../course/Course.ts'
import { advance, type PhysicsParams } from '../physics/model.ts'

export interface RideProgress {
  /** 走行中（一時停止を除く）の経過時間 [s] */
  elapsedS: number
  distanceM: number
  speedMps: number
  finished: boolean
}

export const INITIAL_PROGRESS: RideProgress = {
  elapsedS: 0,
  distanceM: 0,
  speedMps: 0,
  finished: false,
}

/**
 * 走行を dtS 進める。現在地の勾配で物理モデルを積分し、終点に達したら finished にする。
 * ゴール時刻は最後の区間を線形補間して求める。
 */
export function stepRide(
  progress: RideProgress,
  powerW: number,
  dtS: number,
  course: Course,
  physics: PhysicsParams,
): RideProgress {
  if (progress.finished || dtS <= 0) return progress
  const grade = course.gradeAt(progress.distanceM)
  const next = advance(progress, powerW, grade, dtS, physics)
  if (next.distanceM < course.distanceM) {
    return { ...next, elapsedS: progress.elapsedS + dtS, finished: false }
  }
  const travelledM = next.distanceM - progress.distanceM
  const fraction = travelledM > 0 ? (course.distanceM - progress.distanceM) / travelledM : 1
  return {
    speedMps: next.speedMps,
    distanceM: course.distanceM,
    elapsedS: progress.elapsedS + dtS * fraction,
    finished: true,
  }
}
