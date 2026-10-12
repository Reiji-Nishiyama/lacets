import type { TimedTrack } from './TimedTrack.ts'

export interface GhostState {
  /** ゴーストとの時間差 [s]。負ならゴーストより速い。比較できない区間では null */
  deltaS: number | null
  /** 同じ経過時間でのゴーストの位置 [m] */
  ghostDistanceM: number
}

/**
 * 走行中にゴーストと比べる（docs/02 §7: Δt = tUser(d) − tGhost(d)）。
 * ゴーストがルートの途中（coveredFromM）から始まる場合は、ユーザーがそこを通過した時刻を基準にする。
 */
export class GhostComparator {
  private readonly ghost: TimedTrack
  /** ユーザーがゴーストの開始距離を通過した経過時間 */
  private userStartS: number | null

  constructor(ghost: TimedTrack) {
    this.ghost = ghost
    this.userStartS = ghost.coveredFromM <= 0 ? 0 : null
  }

  update(distanceM: number, elapsedS: number): GhostState {
    if (this.userStartS === null && distanceM >= this.ghost.coveredFromM) {
      this.userStartS = elapsedS
    }
    if (this.userStartS === null) {
      return { deltaS: null, ghostDistanceM: this.ghost.coveredFromM }
    }
    const userS = elapsedS - this.userStartS
    const ghostS = this.ghost.timeAt(distanceM)
    return {
      deltaS: ghostS === null ? null : userS - ghostS,
      ghostDistanceM: this.ghost.distanceAt(userS),
    }
  }
}
