import { useMemo } from 'react'
import type { ProfilePoint } from '../../domain/course/types.ts'
import { minimapGeometry } from '../ride/minimapGeometry.ts'

const W = 320
const H = 180

/**
 * ルート一覧のカードの絵（docs/07-design.md）。ルートの形だけを白い縁取りの緑の線で描き、
 * スタートは白、ゴールは太陽の黄色の丸。地図タイルを使わないので一覧が軽い
 */
export function RouteThumbnail({ profile }: { profile: readonly ProfilePoint[] }) {
  const g = useMemo(() => minimapGeometry(profile, W, H, 22), [profile])
  const start = g.pointAt(0)
  const goal = g.pointAt(profile[profile.length - 1]?.distanceM ?? 0)
  return (
    <svg className="route-thumb" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <polyline points={g.all} className="minimap-casing" />
      <polyline points={g.all} className="minimap-done" />
      <circle cx={start.x} cy={start.y} r="7" className="thumb-start" />
      <circle cx={goal.x} cy={goal.y} r="8" className="thumb-goal" />
    </svg>
  )
}
