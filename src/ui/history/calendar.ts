/** 走行履歴のカレンダーの計算（端末のローカル時刻で日をまとめる） */

export interface YearMonth {
  year: number
  /** 0 = 1 月 */
  month: number
}

/** その日の 0 時（ローカル時刻）を表す日のキー「2026-10-25」 */
export function dayKey(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function yearMonthOf(ms: number): YearMonth {
  const d = new Date(ms)
  return { year: d.getFullYear(), month: d.getMonth() }
}

export function addMonths(ym: YearMonth, n: number): YearMonth {
  const total = ym.year * 12 + ym.month + n
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 }
}

export function sameMonth(ms: number, ym: YearMonth): boolean {
  const d = new Date(ms)
  return d.getFullYear() === ym.year && d.getMonth() === ym.month
}

/**
 * 月の日付を週ごとに並べる（日曜はじまり）。月の外の枠は null
 */
export function monthGrid(ym: YearMonth): (Date | null)[][] {
  const first = new Date(ym.year, ym.month, 1)
  const days = new Date(ym.year, ym.month + 1, 0).getDate()
  const cells: (Date | null)[] = Array.from({ length: first.getDay() }, () => null)
  for (let d = 1; d <= days; d++) cells.push(new Date(ym.year, ym.month, d))
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: (Date | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

/** 日のキーごとの件数 */
export function countByDay(timesMs: readonly number[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const ms of timesMs) {
    const k = dayKey(ms)
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  return counts
}
