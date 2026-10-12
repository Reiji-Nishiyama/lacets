import { useMemo } from 'react'
import type { ProfilePoint } from '../../domain/course/types.ts'
import { formatKm } from '../format.ts'
import { t } from '../i18n/index.ts'
import { gradeColor } from './gradeColor.ts'

const WIDTH = 1000
const HEIGHT = 240
const PAD = { top: 24, right: 0, bottom: 0, left: 0 }
/** 描画する列の数。長いルートでも描画が重くならないよう間引く */
const MAX_COLUMNS = 400

interface Column {
  x0: number
  x1: number
  e0: number
  e1: number
  grade: number
}

/** 標高と勾配の SVG プロファイル。markerDistanceM に現在位置の線を引く */
export function ElevationProfile({
  profile,
  markerDistanceM,
  ghostDistanceM,
}: {
  profile: readonly ProfilePoint[]
  markerDistanceM?: number
  /** ゴーストの位置（点線で表示） */
  ghostDistanceM?: number
}) {
  const { columns, minE, maxE, totalM } = useMemo(() => buildColumns(profile), [profile])
  const plotW = WIDTH - PAD.left - PAD.right
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const range = Math.max(10, maxE - minE)
  const x = (d: number) => PAD.left + (d / totalM) * plotW
  const y = (e: number) => PAD.top + plotH - ((e - minE) / range) * plotH
  const baseY = PAD.top + plotH

  return (
    <div className="elevation-profile">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={t('profile.label')}
        preserveAspectRatio="none"
      >
        {colorRuns(columns).map((run, i) => (
          <polygon
            key={i}
            points={[
              `${x(run[0]!.x0)},${baseY}`,
              `${x(run[0]!.x0)},${y(run[0]!.e0)}`,
              ...run.map((c) => `${x(c.x1)},${y(c.e1)}`),
              `${x(run[run.length - 1]!.x1)},${baseY}`,
            ].join(' ')}
            fill={gradeColor(run[0]!.grade)}
          />
        ))}
        {ghostDistanceM !== undefined && (
          <line
            className="profile-ghost-marker"
            data-testid="profile-ghost-marker"
            vectorEffect="non-scaling-stroke"
            x1={x(ghostDistanceM)}
            x2={x(ghostDistanceM)}
            y1={PAD.top}
            y2={baseY}
          />
        )}
        {markerDistanceM !== undefined && (
          <line
            className="profile-marker"
            vectorEffect="non-scaling-stroke"
            x1={x(markerDistanceM)}
            x2={x(markerDistanceM)}
            y1={PAD.top}
            y2={baseY}
          />
        )}
      </svg>
      {/* 文字は SVG の伸縮で歪まないよう HTML で重ねる */}
      <span className="axis-label axis-top">
        {Math.round(maxE)} {t('unit.m')}
      </span>
      <span className="axis-label axis-bottom">
        {Math.round(minE)} {t('unit.m')}
      </span>
      <span className="axis-label axis-end">
        {formatKm(totalM)} {t('unit.km')}
      </span>
    </div>
  )
}

function buildColumns(profile: readonly ProfilePoint[]) {
  const totalM = profile[profile.length - 1]?.distanceM || 1
  let minE = Infinity
  let maxE = -Infinity
  for (const p of profile) {
    minE = Math.min(minE, p.elevationM)
    maxE = Math.max(maxE, p.elevationM)
  }
  const n = Math.min(MAX_COLUMNS, Math.max(1, profile.length - 1))
  const columns: Column[] = []
  let j = 0
  const elevationAt = (d: number) => {
    while (j < profile.length - 2 && profile[j + 1]!.distanceM < d) j++
    const a = profile[j]!
    const b = profile[j + 1] ?? a
    const span = b.distanceM - a.distanceM
    const tt = span > 0 ? Math.min(1, Math.max(0, (d - a.distanceM) / span)) : 0
    return a.elevationM + (b.elevationM - a.elevationM) * tt
  }
  let prevE = elevationAt(0)
  for (let i = 0; i < n; i++) {
    const x0 = (i / n) * totalM
    const x1 = ((i + 1) / n) * totalM
    const e1 = elevationAt(x1)
    columns.push({ x0, x1, e0: prevE, e1, grade: (e1 - prevE) / (x1 - x0) })
    prevE = e1
  }
  return { columns, minE, maxE, totalM }
}

/** 同じ色が続く列を 1 つの多角形にまとめる（継ぎ目の隙間と要素数を減らす） */
function colorRuns(columns: Column[]): Column[][] {
  const runs: Column[][] = []
  for (const c of columns) {
    const last = runs[runs.length - 1]
    if (last && gradeColor(last[0]!.grade) === gradeColor(c.grade)) last.push(c)
    else runs.push([c])
  }
  return runs
}
