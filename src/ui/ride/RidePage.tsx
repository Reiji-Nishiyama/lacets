import { useMemo, useState } from 'react'
import { progressMarkers } from '../../domain/course/progressMarkers.ts'
import { formatDuration } from '../../domain/units.ts'
import { rideActions, useRideStore } from '../../store/rideStore.ts'
import { formatDelta, formatGradePct, formatInt, formatKm, formatKmh } from '../format.ts'
import { t } from '../i18n/index.ts'
import { RideVisual, VISUAL_MODES, type VisualMode } from '../media/RideVisual.tsx'
import { useNavigation } from '../navigation.ts'
import { ProgressMarkerRow } from './ProgressMarkerRow.tsx'
import { RideSummaryPanel } from './RideSummaryPanel.tsx'
import { RouteMinimap } from './RouteMinimap.tsx'

/**
 * 走行画面（docs/07-design.md の統合案）。上に大きな風景と重ねた札・小さな地図、
 * 下の白い面に印の列と数字。1〜2 m 離れて見るので、パワーをいちばん大きく
 */
export function RidePage() {
  const route = useRideStore((s) => s.route)
  const snapshot = useRideStore((s) => s.snapshot)
  const ghost = useRideStore((s) => s.ghost)
  const ghostState = useRideStore((s) => s.ghostState)
  const course = useRideStore((s) => s.course)
  const navigate = useNavigation((s) => s.navigate)
  const [mode, setMode] = useState<VisualMode>('auto')
  const markers = useMemo(() => (route ? progressMarkers(route.profile) : null), [route])

  if (!route || !snapshot || !course) return null
  const { status, position } = snapshot
  const ghostPosition =
    ghost && ghostState ? course.positionAt(ghostState.ghostDistanceM) : undefined
  const delta = ghostState?.deltaS ?? null
  const paused = status === 'paused' || status === 'autoPaused'

  const exit = () => {
    rideActions.exit()
    navigate({ name: 'routes' })
  }

  return (
    <section className="ride-screen">
      <RideVisual
        route={route}
        course={course}
        distanceM={snapshot.distanceM}
        position={position}
        ghostPosition={ghostPosition}
        mode={mode}
      >
        <div className="stage-pills stage-top-left">
          <h2 className="stage-pill stage-title">{route.name}</h2>
          <span
            className={`stage-pill ride-status ride-status-${status}`}
            data-testid="ride-status"
          >
            {t(`ride.status.${status}`)}
          </span>
        </div>
        {ghost && (
          <div
            className={`stage-pill stage-top-right ghost-pill${delta !== null && delta < 0 ? ' ahead' : ''}`}
            title={delta === null ? undefined : t(delta < 0 ? 'ghost.ahead' : 'ghost.behind')}
          >
            {t('metric.ghostDelta')}{' '}
            <span data-testid="ride-ghost-delta">{formatDelta(delta)}</span>
          </div>
        )}
        <RouteMinimap
          profile={route.profile}
          distanceM={snapshot.distanceM}
          ghostDistanceM={ghostState?.ghostDistanceM}
        />
        {paused && (
          <div className="stage-pause" role="status">
            <p className="stage-pause-title">
              {t(status === 'paused' ? 'ride.paused.title' : 'ride.autoPaused.title')}
            </p>
            {status === 'paused' ? (
              <button type="button" className="button-primary" onClick={rideActions.resume}>
                {t('ride.resume')}
              </button>
            ) : (
              <p className="hint">{t('ride.autoPaused.hint')}</p>
            )}
          </div>
        )}
      </RideVisual>

      <div className="ride-panel">
        {markers && <ProgressMarkerRow markers={markers} distanceM={snapshot.distanceM} />}
        <dl className="ride-numbers">
          <div className="ride-number ride-number-main">
            <dt>{t('metric.power')}</dt>
            <dd>
              <span data-testid="ride-power">{formatInt(snapshot.powerW)}</span>
              <span className="unit">{t('unit.watt')}</span>
            </dd>
          </div>
          <div className="ride-number">
            <dt>{t('metric.grade')}</dt>
            <dd>
              <span data-testid="ride-grade">{formatGradePct(position.grade)}</span>
              <span className="unit">{t('unit.percent')}</span>
            </dd>
          </div>
          <div className="ride-number">
            <dt>{t('metric.speed')}</dt>
            <dd>
              <span data-testid="ride-speed">{formatKmh(snapshot.speedMps)}</span>
              <span className="unit">{t('unit.kmh')}</span>
            </dd>
          </div>
          <div className="ride-number">
            <dt>{t('metric.cadence')}</dt>
            <dd>
              {formatInt(snapshot.cadenceRpm)}
              <span className="unit">{t('unit.rpm')}</span>
            </dd>
          </div>
          <div className="ride-number">
            <dt>{t('metric.heartRate')}</dt>
            <dd>
              {formatInt(snapshot.heartRateBpm)}
              <span className="unit">{t('unit.bpm')}</span>
            </dd>
          </div>
        </dl>
        <div className="ride-footer">
          <p className="ride-progress">
            <span>
              {t('metric.elapsed')}{' '}
              <strong data-testid="ride-elapsed">{formatDuration(snapshot.elapsedS)}</strong>
            </span>
            <span>
              <strong data-testid="ride-distance">{formatKm(snapshot.travelledM, 2)}</strong>{' '}
              {t('unit.km')} {t('ride.travelled')}
            </span>
            <span>
              {t('metric.remaining')}{' '}
              <strong data-testid="ride-remaining">{formatKm(snapshot.remainingM, 2)}</strong>{' '}
              {t('unit.km')}
            </span>
          </p>
          <div className="tabs view-tabs" role="tablist" aria-label={t('ride.view')}>
            {VISUAL_MODES.map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                className={`tab${mode === m ? ' tab-active' : ''}`}
                onClick={() => setMode(m)}
              >
                {t(`visual.mode.${m}`)}
              </button>
            ))}
          </div>
          <div className="ride-controls">
            {status === 'running' || status === 'autoPaused' ? (
              <button type="button" onClick={rideActions.pause}>
                {t('ride.pause')}
              </button>
            ) : null}
            {status === 'finished' ? (
              <button type="button" className="button-primary" onClick={exit}>
                {t('ride.exit')}
              </button>
            ) : (
              <button
                type="button"
                className="button-subtle"
                onClick={() => confirm(t('ride.finishConfirm')) && rideActions.finish()}
              >
                {t('ride.finish')}
              </button>
            )}
          </div>
        </div>
      </div>

      {status === 'finished' && <RideSummaryPanel />}
    </section>
  )
}
