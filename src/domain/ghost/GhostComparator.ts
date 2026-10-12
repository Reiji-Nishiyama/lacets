import type { TimedTrack } from './TimedTrack.ts'

export interface GhostState {
  /** ゴーストとの時間差 [s]。負ならゴーストより速い。比較できない区間では null */
  deltaS: number | null
  /** 同じ経過時間でのゴーストの位置 [m] */
  ghostDistanceM: number
}

/**
 * 走行中にゴーストと比べる（docs/02 §7: Δt = tUser(d) − tGhost(d)）。
 * 比べ始める地点（ユーザーの開始地点とゴーストの開始距離の遠い方）を基準に、
 * そこからの経過時間どうしを比べる。ルートの途中から走り始めた場合や、
 * ゴーストがルートの途中から始まる場合も同じ扱いになる。
 */
export class GhostComparator {
  private readonly ghost: TimedTrack
  /** 比べ始めた時点のユーザーの経過時間と、その地点のゴーストの時刻 */
  private base: { userS: number; ghostS: number } | null = null

  constructor(ghost: TimedTrack) {
    this.ghost = ghost
  }

  /** 走行開始時（経過 0 秒）から順に呼ぶこと。最初に比べられた地点を基準にする */
  update(distanceM: number, elapsedS: number): GhostState {
    if (!this.base && distanceM >= this.ghost.coveredFromM) {
      const ghostS = this.ghost.timeAt(distanceM)
      // ゴーストの終点より先から走り始めた場合は比べられない
      if (ghostS !== null) this.base = { userS: elapsedS, ghostS }
    }
    if (!this.base) {
      return { deltaS: null, ghostDistanceM: this.ghost.coveredFromM }
    }
    const userS = elapsedS - this.base.userS
    const ghostS = this.ghost.timeAt(distanceM)
    return {
      deltaS: ghostS === null ? null : userS - (ghostS - this.base.ghostS),
      ghostDistanceM: this.ghost.distanceAt(this.base.ghostS + userS),
    }
  }
}
