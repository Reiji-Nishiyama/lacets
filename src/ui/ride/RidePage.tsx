import { formatDuration } from '../../domain/units.ts'
import { rideActions, useRideStore } from '../../store/rideStore.ts'
import { ElevationProfile } from '../common/ElevationProfile.tsx'
import { RouteMap } from '../common/RouteMap.tsx'
import { Stat } from '../common/Stat.tsx'
import { formatGradePct, formatInt, formatKm, formatKmh } from '../format.ts'
import { t } from '../i18n/index.ts'
import { useNavigation } from '../navigation.ts'

export function RidePage() {
  const route = useRideStore((s) => s.route)
  const snapshot = useRideStore((s) => s.snapshot)
  const summary = useRideStore((s) => s.summary)
  const navigate = useNavigation((s) => s.navigate)

  if (!route || !snapshot) return null
  const { status, position } = snapshot

  const exit = () => {
    rideActions.exit()
    navigate({ name: 'routes' })
  }

  return (
    <section className="ride">
      <div className="page-title-row">
        <h2 className="page-title">{route.name}</h2>
        <span className={`ride-status ride-status-${status}`} data-testid="ride-status">
          {t(`ride.status.${status}`)}
        </span>
      </div>

      <div className="ride-metrics">
        <Stat
          label={t('metric.power')}
          value={formatInt(snapshot.powerW)}
          unit={t('unit.watt')}
          testId="ride-power"
        />
        <Stat
          label={t('metric.speed')}
          value={formatKmh(snapshot.speedMps)}
          unit={t('unit.kmh')}
          testId="ride-speed"
        />
        <Stat
          label={t('metric.grade')}
          value={formatGradePct(position.grade)}
          unit={t('unit.percent')}
          testId="ride-grade"
        />
        <Stat
          label={t('metric.cadence')}
          value={formatInt(snapshot.cadenceRpm)}
          unit={t('unit.rpm')}
        />
        <Stat
          label={t('metric.heartRate')}
          value={formatInt(snapshot.heartRateBpm)}
          unit={t('unit.bpm')}
        />
        <Stat
          label={t('metric.elapsed')}
          value={formatDuration(snapshot.elapsedS)}
          testId="ride-elapsed"
        />
        <Stat
          label={t('metric.distance')}
          value={formatKm(snapshot.distanceM, 2)}
          unit={t('unit.km')}
          testId="ride-distance"
        />
        <Stat
          label={t('metric.remaining')}
          value={formatKm(snapshot.remainingM, 2)}
          unit={t('unit.km')}
        />
      </div>

      {summary && (
        <div className="panel summary" data-testid="ride-summary">
          <h3>{t('summary.title')}</h3>
          <div className="stats">
            <Stat
              label={t('metric.distance')}
              value={formatKm(summary.distanceM, 2)}
              unit={t('unit.km')}
            />
            <Stat label={t('metric.elapsed')} value={formatDuration(summary.elapsedS)} />
            <Stat
              label={t('summary.averagePower')}
              value={formatInt(summary.averagePowerW)}
              unit={t('unit.watt')}
            />
          </div>
        </div>
      )}

      <div className="actions">
        {status === 'running' || status === 'autoPaused' ? (
          <button type="button" onClick={rideActions.pause}>
            {t('ride.pause')}
          </button>
        ) : null}
        {status === 'paused' && (
          <button type="button" className="button-primary" onClick={rideActions.resume}>
            {t('ride.resume')}
          </button>
        )}
        {status !== 'finished' ? (
          <button
            type="button"
            className="button-subtle"
            onClick={() => confirm(t('ride.finishConfirm')) && rideActions.finish()}
          >
            {t('ride.finish')}
          </button>
        ) : (
          <button type="button" className="button-primary" onClick={exit}>
            {t('ride.exit')}
          </button>
        )}
      </div>

      <ElevationProfile profile={route.profile} markerDistanceM={snapshot.distanceM} />
      <RouteMap profile={route.profile} position={position} follow />
    </section>
  )
}
