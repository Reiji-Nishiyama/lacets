import { useLiveQuery } from 'dexie-react-hooks'
import { formatDuration } from '../../domain/units.ts'
import { listRides } from '../../store/rideRepository.ts'
import { formatDateTime, formatInt, formatKm } from '../format.ts'
import { t } from '../i18n/index.ts'
import { useNavigation } from '../navigation.ts'

export function HistoryPage() {
  const rides = useLiveQuery(() => listRides(), [])
  const navigate = useNavigation((s) => s.navigate)

  return (
    <section>
      <h2 className="page-title">{t('history.title')}</h2>
      {rides && rides.length === 0 && <p className="hint">{t('history.empty')}</p>}
      <ul className="route-list">
        {rides?.map((r) => (
          <li key={r.id} className="route-item">
            <button
              type="button"
              className="route-open"
              onClick={() => navigate({ name: 'rideDetail', rideId: r.id })}
            >
              <span className="route-name">
                {formatDateTime(r.startedAtMs)} {r.routeName}
              </span>
              <span className="route-stats">
                {formatKm(r.stats.distanceM, 2)} {t('unit.km')} ・{' '}
                {formatDuration(r.stats.movingTimeS)} ・ {formatInt(r.stats.averagePowerW)}{' '}
                {t('unit.watt')}
                {r.ghost ? ` ・ ${t('report.withGhost', { name: r.ghost.name })}` : ''}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
