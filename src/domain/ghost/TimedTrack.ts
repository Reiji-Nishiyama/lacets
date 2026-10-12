/**
 * ルート上の距離と経過時間の対応（docs/02-architecture.md §7 の tGhost(d)）。
 * ゴースト（実走・過去の走行）にも、走行後のユーザー自身の記録にも使う。
 */

export interface DistanceTime {
  distanceM: number
  timeS: number
}

export interface PowerSample {
  timeS: number
  powerW: number
}

export interface TimedTrackInput {
  distanceM: number
  timeS: number
  powerW?: number
}

/** 最初の点からこの距離以内に留まっている間はスタート前の待機とみなす [m] */
const START_TOLERANCE_M = 10

/** 最大距離からこれ以内の後退は GPS の揺れ（停車中）とみなす。それより戻ったら逆走 [m] */
const STALL_TOLERANCE_M = 15

/** パワーのサンプル間隔がこれより空いたら、その間は記録なし（停止・オートポーズ）とみなす [s] */
const MAX_POWER_HOLD_S = 10

export class TimedTrack {
  /** 距離・時刻とも狭義単調増加 */
  readonly points: readonly DistanceTime[]
  readonly powerSamples: readonly PowerSample[]

  private constructor(points: DistanceTime[], powerSamples: PowerSample[]) {
    this.points = points
    this.powerSamples = powerSamples
  }

  /**
   * 時刻順の (距離, 時刻) から作る。逆走・GPS の揺れは距離の累積最大値で単調化し、
   * 同じ距離に留まった（停車した）場合はそこを離れた時刻を採る（大きく戻った点は無視）。
   * 時刻はスタート地点（最初の点から startToleranceM 以内）を最後に離れた点を 0 にする。
   */
  static fromSamples(
    samples: readonly TimedTrackInput[],
    /** スタート前の待機とみなす範囲 [m]。静止状態から記録している場合は 0 */
    startToleranceM = START_TOLERANCE_M,
  ): TimedTrack {
    const sorted = [...samples].sort((a, b) => a.timeS - b.timeS)
    const points: DistanceTime[] = []
    let maxD = -Infinity
    for (const s of sorted) {
      if (s.distanceM > maxD) {
        maxD = s.distanceM
        points.push({ distanceM: s.distanceM, timeS: s.timeS })
      } else if (points.length > 0 && s.distanceM >= maxD - STALL_TOLERANCE_M) {
        // 停車中（揺れの範囲で留まっている）: 最後の点の時刻を「離れた時刻」に更新する。
        // 大きく戻った点（逆走、ゴール後に同じ道を下る等）は無視する
        points[points.length - 1] = { distanceM: maxD, timeS: s.timeS }
      }
    }
    // スタート地点での待機（GPS の揺れで少し進んだ点を含む）を除く
    const d0 = points[0]?.distanceM ?? 0
    const leave = points.findIndex((p) => p.distanceM > d0 + startToleranceM)
    const started = leave > 0 ? points.slice(leave - 1) : points
    const t0 = started[0]?.timeS ?? 0
    const normalized = started.map((p) => ({ distanceM: p.distanceM, timeS: p.timeS - t0 }))
    // 時刻が同じ点が続くと補間できないので落とす
    const strictly = normalized.filter((p, i) => i === 0 || p.timeS > normalized[i - 1]!.timeS)
    const powerSamples = sorted.flatMap((s) =>
      s.powerW === undefined ? [] : [{ timeS: s.timeS - t0, powerW: s.powerW }],
    )
    return new TimedTrack(strictly, powerSamples)
  }

  get coveredFromM(): number {
    return this.points[0]?.distanceM ?? 0
  }

  get coveredToM(): number {
    return this.points[this.points.length - 1]?.distanceM ?? 0
  }

  get durationS(): number {
    return this.points[this.points.length - 1]?.timeS ?? 0
  }

  /** 距離 d に到達した時刻。範囲外は null */
  timeAt(distanceM: number): number | null {
    const p = this.points
    if (p.length < 2 || distanceM < this.coveredFromM || distanceM > this.coveredToM) return null
    const i = upperBound(p, distanceM, (x) => x.distanceM)
    const a = p[Math.max(0, i - 1)]!
    const b = p[Math.min(p.length - 1, i)]!
    const span = b.distanceM - a.distanceM
    return span > 0 ? a.timeS + ((distanceM - a.distanceM) / span) * (b.timeS - a.timeS) : a.timeS
  }

  /** 時刻 t での距離。範囲外は端にクランプ */
  distanceAt(timeS: number): number {
    const p = this.points
    if (p.length === 0) return 0
    if (timeS <= 0) return this.coveredFromM
    if (timeS >= this.durationS) return this.coveredToM
    const i = upperBound(p, timeS, (x) => x.timeS)
    const a = p[i - 1]!
    const b = p[i]!
    return a.distanceM + ((timeS - a.timeS) / (b.timeS - a.timeS)) * (b.distanceM - a.distanceM)
  }

  /**
   * [t0, t1] の時間加重平均パワー。各サンプルの値は次のサンプルまで（最大 10 秒）続くとみなす。
   * パワーの記録がなければ null
   */
  averagePowerBetween(t0: number, t1: number): number | null {
    const s = this.powerSamples
    if (s.length === 0 || t1 <= t0) return null
    let energy = 0
    let covered = 0
    for (let i = 0; i < s.length; i++) {
      const start = s[i]!.timeS
      const next = s[i + 1]?.timeS ?? start + 1
      const end = Math.min(next, start + MAX_POWER_HOLD_S)
      const lo = Math.max(start, t0)
      const hi = Math.min(end, t1)
      if (hi > lo) {
        energy += s[i]!.powerW * (hi - lo)
        covered += hi - lo
      }
      if (start > t1) break
    }
    return covered > 0 ? energy / covered : null
  }
}

/** key(arr[i]) > value となる最初の i（なければ arr.length） */
function upperBound<T>(arr: readonly T[], value: number, key: (x: T) => number): number {
  let lo = 0
  let hi = arr.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (key(arr[mid]!) <= value) lo = mid + 1
    else hi = mid
  }
  return lo
}
