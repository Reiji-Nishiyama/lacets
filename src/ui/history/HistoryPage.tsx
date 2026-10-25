import { useLiveQuery } from 'dexie-react-hooks'
import { formatDuration } from '../../domain/units.ts'
import { listRides } from '../../store/rideRepository.ts'
import { formatInt, formatKm, formatMonthDay, formatYearTime } from '../format.ts'
import { t } from '../i18n/index.ts'
import { useNavigation } from '../navigation.ts'

/** 走行履歴（docs/07-design.md）。白い面に、日付の札とルート名・数字のチップを 1 行ずつ並べる */
export function HistoryPage() {
  const rides = useLiveQuery(() => listRides(), [])
  const navigate = useNavigation((s) => s.navigate)

  return (
    <section>
      <div className="page-hero">
        <h2 className="page-hero-title">{t('history.title')}</h2>
        <p className="page-hero-subtitle">{t('history.subtitle')}</p>
      </div>
      <div className="sheet">
        {rides && rides.length === 0 && <p className="hint">{t('history.empty')}</p>}
        <ul className="ride-list">
          {rides?.map((r) => (
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
                      {t('history.duration')} <strong>{formatDuration(r.stats.movingTimeS)}</strong>
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
    </section>
  )
}
