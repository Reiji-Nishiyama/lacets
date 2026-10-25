import { describe, expect, it } from 'vitest'
import { addMonths, countByDay, dayKey, monthGrid, sameMonth } from './calendar.ts'

describe('calendar', () => {
  it('2026 年 10 月は木曜はじまりの 31 日、5 週', () => {
    const weeks = monthGrid({ year: 2026, month: 9 })
    expect(weeks).toHaveLength(5)
    expect(weeks[0]!.slice(0, 4)).toEqual([null, null, null, null])
    expect(weeks[0]![4]!.getDate()).toBe(1)
    expect(weeks.flat().filter(Boolean)).toHaveLength(31)
    for (const w of weeks) expect(w).toHaveLength(7)
  })

  it('月の加減は年をまたぐ', () => {
    expect(addMonths({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 })
    expect(addMonths({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 })
  })

  it('日ごとに数える（ローカル時刻）', () => {
    const a = new Date(2026, 9, 25, 7, 0).getTime()
    const b = new Date(2026, 9, 25, 21, 30).getTime()
    const c = new Date(2026, 9, 26, 6, 0).getTime()
    const counts = countByDay([a, b, c])
    expect(counts.get(dayKey(a))).toBe(2)
    expect(counts.get('2026-10-26')).toBe(1)
    expect(sameMonth(a, { year: 2026, month: 9 })).toBe(true)
    expect(sameMonth(a, { year: 2026, month: 8 })).toBe(false)
  })
})
