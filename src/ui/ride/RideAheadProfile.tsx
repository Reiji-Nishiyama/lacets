import { useMemo } from 'react'
import type { Course } from '../../domain/course/Course.ts'
import type { ProgressMarkers } from '../../domain/course/progressMarkers.ts'
import { gradeColor } from '../common/gradeColor.ts'
import { formatGradePct, formatMeters } from '../format.ts'
import { t } from '../i18n/index.ts'
import { aheadProfileGeometry, DEFAULT_AHEAD } from './aheadProfileGeometry.ts'

const { width: W, height: H, windowM: WINDOW_M } = DEFAULT_AHEAD
/** SVG の座標を、表示の大きさによらない位置（%）に */
const pct = (v: number, of: number) => `${(v / of) * 100}%`
/** 再計算の間隔 [m]（毎フレーム描き直さない） */
const QUANTUM_M = 5

/**
 * 走行中の「この先 2 km」（docs/07-design.md、案 2）。風景の左下に半透明で重ね、
 * 250 m ごとの勾配を色と数字で見せる。次の印（ヘアピンなど）とゴースト、次の 500 m の平均勾配も
 */
export function RideAheadProfile({
  course,
  distanceM,
  ghostDistanceM,
  markers,
}: {
  course: Course
  distanceM: number
  ghostDistanceM?: number
  markers: ProgressMarkers | null
}) {
  const fromM = Math.floor(distanceM / QUANTUM_M) * QUANTUM_M
  const g = useMemo(
    () => aheadProfileGeometry((d) => course.positionAt(d).elevationM, course.distanceM, fromM),
    [course, fromM],
  )
  const elevationAt = (d: number) => course.positionAt(d).elevationM

  const nextIndex = markers ? markers.positionsM.findIndex((d) => d > distanceM) : -1
  const nextM = nextIndex >= 0 ? markers!.positionsM[nextIndex]! : null
  const nextLabel =
    nextM === null || nextM > g.endM || !markers
      ? null
      : markers.kind === 'hairpin'
        ? t('ride.ahead.hairpin', { n: nextIndex + 1 })
        : markers.kind === 'elevation'
          ? t('ride.ahead.elevation', { elevation: formatMeters(elevationAt(nextM)) })
          : t('ride.ahead.distance', { km: Math.round(nextM / 1000) })
  const ghostInWindow =
    ghostDistanceM !== undefined && ghostDistanceM >= fromM && ghostDistanceM <= g.endM

  return (
    <div className="ahead-profile" data-testid="ahead-profile">
      <div className="ahead-head">
        <span className="ahead-title">{t('ride.ahead.title')}</span>
        {g.next500Grade !== null && (
          <span className="ahead-next">
            {t('ride.ahead.next500')}{' '}
            <strong data-testid="ahead-next500">{formatGradePct(g.next500Grade)}</strong>
            {t('unit.percent')}
          </span>
        )}
      </div>
      <div className="ahead-chart">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('ride.ahead.aria')}>
          {g.slices.map((s, i) => (
            <path key={i} d={s.path} style={{ fill: gradeColor(s.grade) }} />
          ))}
          <polyline points={g.line} className="ahead-line" />
          {nextM !== null && nextLabel && (
            <line x1={g.x(nextM)} x2={g.x(nextM)} y1={20} y2={H} className="ahead-marker" />
          )}
          {g.goalInWindow && (
            <line x1={g.x(g.endM)} x2={g.x(g.endM)} y1={0} y2={H} className="ahead-goal" />
          )}
          {ghostInWindow && (
            <circle
              cx={g.x(ghostDistanceM!)}
              cy={g.y(elevationAt(ghostDistanceM!))}
              r={5}
              className="ahead-ghost"
            />
          )}
          <circle cx={g.x(fromM)} cy={g.y(elevationAt(fromM))} r={7} className="ahead-here" />
        </svg>
        {g.slices.map((s, i) =>
          g.x(g.endM) - s.labelX < 4 ? null : (
            <span
              key={i}
              className="ahead-grade"
              style={{ left: pct(s.labelX, W), top: pct(s.labelY, H) }}
            >
              {Math.round(s.grade * 100)}%
            </span>
          ),
        )}
        {nextM !== null && nextLabel && (
          <span className="ahead-marker-label" style={{ left: pct(g.x(nextM) + 4, W) }}>
            {nextLabel}
          </span>
        )}
        {g.goalInWindow && (
          <span className="ahead-goal-label" style={{ left: pct(g.x(g.endM) - 4, W) }}>
            {t('ride.ahead.goal')}
          </span>
        )}
      </div>
      <div className="ahead-axis" aria-hidden="true">
        <span>{t('ride.ahead.now')}</span>
        {[0.5, 1, 1.5].map((km) => (
          <span key={km}>+{km}</span>
        ))}
        <span>+{WINDOW_M / 1000} km</span>
      </div>
    </div>
  )
}
