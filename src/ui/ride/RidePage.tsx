import { formatDuration } from '../../domain/units.ts'
import { rideActions, useRideStore } from '../../store/rideStore.ts'
import { ElevationProfile } from '../common/ElevationProfile.tsx'
import { RouteMap } from '../common/RouteMap.tsx'
import { Stat } from '../common/Stat.tsx'
import { formatDelta, formatGradePct, formatInt, formatKm, formatKmh } from '../format.ts'
import { t } from '../i18n/index.ts'
import { useNavigation } from '../navigation.ts'
import { RideSummaryPanel } from './RideSummaryPanel.tsx'

export function RidePage() {
  const route = useRideStore((s) => s.route)
  const snapshot = useRideStore((s) => s.snapshot)
  const ghost = useRideStore((s) => s.ghost)
  const ghostState = useRideStore((s) => s.ghostState)
  const course = useRideStore((s) => s.course)
  const navigate = useNavigation((s) => s.navigate)

  if (!route || !snapshot) return null
  const { status, position } = snapshot
  const ghostPosition =
    ghost && ghostState && course ? course.positionAt(ghostState.ghostDistanceM) : undefined
  const delta = ghostState?.deltaS ?? null

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
        {ghost && (
          <div
            className={`stat ghost-delta ${delta === null ? '' : delta < 0 ? 'delta-ahead' : 'delta-behind'}`}
            title={delta === null ? undefined : t(delta < 0 ? 'ghost.ahead' : 'ghost.behind')}
          >
            <div className="stat-label">{t('metric.ghostDelta')}</div>
            <div className="stat-value" data-testid="ride-ghost-delta">
              {formatDelta(delta)}
            </div>
          </div>
        )}
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

      {status === 'finished' && <RideSummaryPanel />}

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

      <ElevationProfile
        profile={route.profile}
        markerDistanceM={snapshot.distanceM}
        ghostDistanceM={ghostState?.ghostDistanceM}
      />
      <RouteMap profile={route.profile} position={position} ghostPosition={ghostPosition} follow />
    </section>
  )
}
