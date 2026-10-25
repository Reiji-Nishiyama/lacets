import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { formatDuration } from '../../domain/units.ts'
import type { RecordedRide } from '../../recording/types.ts'
import { listRides } from '../../store/rideRepository.ts'
import { formatInt, formatKm, formatMeters, formatMonthDay, formatYearTime } from '../format.ts'
import { t } from '../i18n/index.ts'
import { useNavigation } from '../navigation.ts'
import {
  addMonths,
  countByDay,
  dayKey,
  sameMonth,
  yearMonthOf,
  type YearMonth,
} from './calendar.ts'
import { RideCalendar } from './RideCalendar.tsx'

/**
 * 走行履歴（docs/07-design.md）。左に月のカレンダーと月の合計、右にその月（または選んだ日）の走行。
 * 1 回分は日付の札とルート名・数字のチップの 1 行
 */
export function HistoryPage() {
  const rides = useLiveQuery(() => listRides(), [])
  const navigate = useNavigation((s) => s.navigate)
  // null = まだ選んでいない（いちばん新しい走行の月を出す）
  const [pickedMonth, setPickedMonth] = useState<YearMonth | null>(null)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  // 画面を開いた時刻（走行がなければ今月を出す、カレンダーの「今日」）
  const [openedAtMs] = useState(() => Date.now())

  const latestMs = rides?.reduce((m, r) => Math.max(m, r.startedAtMs), 0) || openedAtMs
  const month = pickedMonth ?? yearMonthOf(latestMs)
  const counts = useMemo(() => countByDay(rides?.map((r) => r.startedAtMs) ?? []), [rides])
  const inMonth = (rides ?? []).filter((r) => sameMonth(r.startedAtMs, month))
  const shown = selectedDay ? inMonth.filter((r) => dayKey(r.startedAtMs) === selectedDay) : inMonth
  const totals = monthTotals(inMonth)

  const changeMonth = (delta: number) => {
    setPickedMonth(addMonths(month, delta))
    setSelectedDay(null)
  }
  const selectedDate = selectedDay ? new Date(`${selectedDay}T00:00`) : null

  return (
    <section>
      <div className="page-hero">
        <h2 className="page-hero-title">{t('history.title')}</h2>
        <p className="page-hero-subtitle">{t('history.subtitle')}</p>
      </div>
      {rides && rides.length === 0 ? (
        <div className="sheet">
          <p className="hint">{t('history.empty')}</p>
        </div>
      ) : (
        <div className="sheet history-sheet">
          <div className="history-side">
            <RideCalendar
              month={month}
              onMonthChange={changeMonth}
              counts={counts}
              today={dayKey(openedAtMs)}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
            />
            <div className="chips" data-testid="month-totals">
              <span className="chip chip-small">
                <strong>{t('history.count', { count: inMonth.length })}</strong>
              </span>
              <span className="chip chip-small">
                <strong>{formatKm(totals.distanceM)}</strong> {t('unit.km')}
              </span>
              <span className="chip chip-small">
                {t('chip.ascent')} <strong>{formatMeters(totals.ascentM)}</strong> {t('unit.m')}
              </span>
              <span className="chip chip-small">
                {t('history.duration')} <strong>{formatDuration(totals.movingTimeS)}</strong>
              </span>
            </div>
          </div>
          <div className="history-main">
            <div className="history-main-head">
              <h3>
                {selectedDate
                  ? t('history.dayRides', {
                      month: selectedDate.getMonth() + 1,
                      day: selectedDate.getDate(),
                    })
                  : t('history.monthRides', { month: month.month + 1 })}
              </h3>
              {selectedDay && (
                <button
                  type="button"
                  className="button-subtle"
                  onClick={() => setSelectedDay(null)}
                >
                  {t('history.showMonth')}
                </button>
              )}
            </div>
            {shown.length === 0 && <p className="hint">{t('history.noneInMonth')}</p>}
            <ul className="ride-list">
              {shown.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className="ride-row"
                    onClick={() => navigate({ name: 'rideDetail', rideId: r.id })}
                  >
                    <span className="ride-date">
                      <span className="ride-date-day">{formatMonthDay(r.startedAtMs)}</span>
                      <span className="ride-date-sub">{formatYearTime(r.startedAtMs)}</span>
                    </span>
                    <span className="ride-row-body">
                      <span className="ride-row-name">{r.routeName}</span>
                      <span className="chips">
                        <span className="chip chip-small">
                          <strong>{formatKm(r.stats.distanceM, 2)}</strong> {t('unit.km')}
                        </span>
                        <span className="chip chip-small">
                          {t('chip.ascent')} <strong>{formatMeters(r.stats.ascentM)}</strong>{' '}
                          {t('unit.m')}
                        </span>
                        <span className="chip chip-small">
                          {t('history.duration')}{' '}
                          <strong>{formatDuration(r.stats.movingTimeS)}</strong>
                        </span>
                        <span className="chip chip-small">
                          {t('summary.averagePower')}{' '}
                          <strong>{formatInt(r.stats.averagePowerW)}</strong> {t('unit.watt')}
                        </span>
                        {r.ghost && (
                          <span className="chip chip-small chip-ghost">
                            {t('report.withGhost', { name: r.ghost.name })}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  )
}

function monthTotals(rides: readonly RecordedRide[]) {
  let distanceM = 0
  let ascentM = 0
  let movingTimeS = 0
  for (const r of rides) {
    distanceM += r.stats.distanceM
    ascentM += r.stats.ascentM
    movingTimeS += r.stats.movingTimeS
  }
  return { distanceM, ascentM, movingTimeS }
}
