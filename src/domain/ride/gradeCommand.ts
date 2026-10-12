import type { Course } from '../course/Course.ts'

/**
 * トレーナーに送る勾配。トレーナーの負荷変化の遅れを見込んで lookaheadS 秒先の勾配を使い、
 * 難易度（0〜1）を掛ける（docs/02-architecture.md §4）。
 */
export function trainerGrade(
  course: Course,
  distanceM: number,
  speedMps: number,
  difficulty: number,
  lookaheadS = 1,
): number {
  return course.gradeAt(distanceM + Math.max(0, speedMps) * lookaheadS) * difficulty
}

export interface GradeThrottleOptions {
  /** これ以上変化したら送る（0.001 = 0.1%） */
  minChange: number
  /** 変化が小さくてもこの間隔で送る [ms] */
  maxIntervalMs: number
}

const DEFAULT_THROTTLE: GradeThrottleOptions = { minChange: 0.001, maxIntervalMs: 1000 }

/** 勾配指令の送信過多を防ぐ。前回送信値から minChange 以上変わったか、maxIntervalMs 経過で送る */
export class GradeThrottle {
  private lastGrade: number | null = null
  private lastSentMs = -Infinity
  private readonly opts: GradeThrottleOptions

  constructor(opts: Partial<GradeThrottleOptions> = {}) {
    this.opts = { ...DEFAULT_THROTTLE, ...opts }
  }

  /** 送るべきなら true を返し、送信済みとして記録する */
  shouldSend(grade: number, nowMs: number): boolean {
    // 0.051 − 0.05 のような差が浮動小数点の誤差で minChange をわずかに下回らないよう許容する
    const changed =
      this.lastGrade === null || Math.abs(grade - this.lastGrade) >= this.opts.minChange - 1e-9
    if (!changed && nowMs - this.lastSentMs < this.opts.maxIntervalMs) return false
    this.lastGrade = grade
    this.lastSentMs = nowMs
    return true
  }

  reset(): void {
    this.lastGrade = null
    this.lastSentMs = -Infinity
  }
}
