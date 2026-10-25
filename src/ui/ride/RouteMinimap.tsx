import { useMemo } from 'react'
import type { ProfilePoint } from '../../domain/course/types.ts'
import { t } from '../i18n/index.ts'
import { minimapGeometry } from './minimapGeometry.ts'

const W = 220
const H = 170

/**
 * 走行中の小さな地図（docs/07-design.md）。ルートの形・走った部分・現在地（太陽の黄色）・
 * ゴースト（灰色）を描く。地図タイルを使わないので、オフラインでも軽い
 */
export function RouteMinimap({
  profile,
  distanceM,
  ghostDistanceM,
}: {
  profile: readonly ProfilePoint[]
  distanceM: number
  ghostDistanceM?: number
}) {
  const g = useMemo(() => minimapGeometry(profile, W, H, 18), [profile])
  const end = profile[profile.length - 1]?.distanceM ?? 0
  const here = g.pointAt(distanceM)
  const goal = g.pointAt(end)
  const ghost = ghostDistanceM === undefined ? null : g.pointAt(ghostDistanceM)
  return (
    <div className="route-minimap">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('ride.minimap')}>
        <polyline points={g.all} className="minimap-casing" />
        <polyline points={g.all} className="minimap-route" />
        <polyline points={g.until(distanceM)} className="minimap-done" />
        <circle cx={goal.x} cy={goal.y} r="6" className="minimap-goal" />
        {ghost && (
          <circle
            cx={ghost.x}
            cy={ghost.y}
            r="6"
            className="minimap-ghost"
            data-testid="minimap-ghost"
          />
        )}
        <circle cx={here.x} cy={here.y} r="8" className="minimap-here" />
      </svg>
    </div>
  )
}
