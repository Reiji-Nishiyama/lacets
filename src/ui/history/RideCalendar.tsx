import { t } from '../i18n/index.ts'
import { dayKey, monthGrid, type YearMonth } from './calendar.ts'

/**
 * 走行履歴の月のカレンダー（docs/07-design.md）。走った日は緑の丸、選んだ日は太陽の黄色。
 * 走った日を押すとその日の走行だけを一覧に出す（もう一度押すと月全体に戻す）
 */
export function RideCalendar({
  month,
  onMonthChange,
  counts,
  today,
  selectedDay,
  onSelectDay,
}: {
  month: YearMonth
  onMonthChange: (delta: number) => void
  /** 日のキーごとの走行回数 */
  counts: ReadonlyMap<string, number>
  /** 今日の日のキー（枠で示す） */
  today: string
  selectedDay: string | null
  onSelectDay: (key: string | null) => void
}) {
  return (
    <div className="calendar">
      <div className="calendar-head">
        <button
          type="button"
          className="calendar-nav"
          aria-label={t('history.prevMonth')}
          onClick={() => onMonthChange(-1)}
        >
          ‹
        </button>
        <h3 className="calendar-title" aria-live="polite">
          {t('history.month', { year: month.year, month: month.month + 1 })}
        </h3>
        <button
          type="button"
          className="calendar-nav"
          aria-label={t('history.nextMonth')}
          onClick={() => onMonthChange(1)}
        >
          ›
        </button>
      </div>
      <table className="calendar-grid">
        <thead>
          <tr>
            {([0, 1, 2, 3, 4, 5, 6] as const).map((w) => (
              <th key={w} scope="col">
                {t(`history.weekday.${w}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {monthGrid(month).map((week, i) => (
            <tr key={i}>
              {week.map((date, j) => {
                if (!date) return <td key={j} />
                const key = dayKey(date.getTime())
                const count = counts.get(key) ?? 0
                const label = { month: month.month + 1, day: date.getDate(), count }
                const classes = [
                  'calendar-day',
                  count > 0 ? 'has-rides' : '',
                  key === selectedDay ? 'selected' : '',
                  key === today ? 'today' : '',
                ]
                  .filter(Boolean)
                  .join(' ')
                return (
                  <td key={j}>
                    {count > 0 ? (
                      <button
                        type="button"
                        className={classes}
                        aria-pressed={key === selectedDay}
                        aria-label={t('history.dayLabelWithRides', label)}
                        onClick={() => onSelectDay(key === selectedDay ? null : key)}
                      >
                        {date.getDate()}
                        {count > 1 && <span className="calendar-count">{count}</span>}
                      </button>
                    ) : (
                      <span className={classes} aria-label={t('history.dayLabel', label)}>
                        {date.getDate()}
                      </span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
