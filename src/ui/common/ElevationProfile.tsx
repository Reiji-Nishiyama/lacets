import { useId, useMemo } from 'react'
import type { ProfilePoint } from '../../domain/course/types.ts'
import { formatKm, formatMeters } from '../format.ts'
import { t } from '../i18n/index.ts'
import { contourIntervalM, reliefColor } from './relief.ts'

const WIDTH = 1000
const HEIGHT = 240
const PAD_TOP = 16
/** 描く点の数の上限（長いルートでも軽く） */
const MAX_POINTS = 600

/**
 * 勾配図（docs/07-design.md）。塗りを等高線の間隔ごとの標高の帯に分け、帯の境目に白い等高線を引く。
 * 地図と同じ色の段なので、地図の色と勾配図の高さが対応する。
 * startDistanceM より手前は淡くし、onSelectDistance があればクリックで地点を選べる
 */
export function ElevationProfile({
  profile,
  markerDistanceM,
  ghostDistanceM,
  startDistanceM,
  onSelectDistance,
}: {
  profile: readonly ProfilePoint[]
  markerDistanceM?: number
  ghostDistanceM?: number
  startDistanceM?: number
  onSelectDistance?: (distanceM: number) => void
}) {
  const clipId = useId()
  const g = useMemo(() => geometry(profile), [profile])
  const x = (d: number) => (d / g.totalM) * WIDTH
  const y = (e: number) =>
    PAD_TOP + (HEIGHT - PAD_TOP) * (1 - (e - g.bottomM) / (g.topM - g.bottomM))

  return (
    <div className={`elevation-profile${onSelectDistance ? ' selectable' : ''}`}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={t('profile.label')}
        preserveAspectRatio="none"
        onClick={
          onSelectDistance
            ? (e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const ratio = (e.clientX - rect.left) / rect.width
                onSelectDistance(Math.min(1, Math.max(0, ratio)) * g.totalM)
              }
            : undefined
        }
      >
        <defs>
          <clipPath id={clipId}>
            <path d={g.area(x, y)} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clipId})`}>
          {g.bands.map((b) => (
            <rect
              key={b.fromM}
              x={0}
              width={WIDTH}
              y={y(b.toM)}
              height={y(b.fromM) - y(b.toM)}
              fill={b.color}
            />
          ))}
          {g.bands.slice(1).map((b) => (
            <line
              key={b.fromM}
              className="profile-contour"
              vectorEffect="non-scaling-stroke"
              x1={0}
              x2={WIDTH}
              y1={y(b.fromM)}
              y2={y(b.fromM)}
            />
          ))}
        </g>
        <path className="profile-line" vectorEffect="non-scaling-stroke" d={g.line(x, y)} />
        {startDistanceM !== undefined && startDistanceM > 0 && (
          <>
            <rect
              className="profile-before-start"
              x={0}
              y={0}
              width={x(startDistanceM)}
              height={HEIGHT}
            />
            <line
              className="profile-start-marker"
              data-testid="profile-start-marker"
              vectorEffect="non-scaling-stroke"
              x1={x(startDistanceM)}
              x2={x(startDistanceM)}
              y1={PAD_TOP}
              y2={HEIGHT}
            />
          </>
        )}
        {ghostDistanceM !== undefined && (
          <line
            className="profile-ghost-marker"
            data-testid="profile-ghost-marker"
            vectorEffect="non-scaling-stroke"
            x1={x(ghostDistanceM)}
            x2={x(ghostDistanceM)}
            y1={PAD_TOP}
            y2={HEIGHT}
          />
        )}
        {markerDistanceM !== undefined && (
          <line
            className="profile-marker"
            vectorEffect="non-scaling-stroke"
            x1={x(markerDistanceM)}
            x2={x(markerDistanceM)}
            y1={PAD_TOP}
            y2={HEIGHT}
          />
        )}
      </svg>
      <div className="profile-axis">
        <span>
          {formatMeters(g.minM)} {t('unit.m')} → {formatMeters(g.maxM)} {t('unit.m')}
        </span>
        <span>{t('profile.contours', { interval: g.intervalM })}</span>
        <span>
          {formatKm(g.totalM)} {t('unit.km')}
        </span>
      </div>
    </div>
  )
}

function geometry(profile: readonly ProfilePoint[]) {
  const totalM = profile[profile.length - 1]?.distanceM || 1
  let minM = Infinity
  let maxM = -Infinity
  for (const p of profile) {
    minM = Math.min(minM, p.elevationM)
    maxM = Math.max(maxM, p.elevationM)
  }
  const intervalM = contourIntervalM(minM, maxM)
  // 帯は等高線の間隔のきりのよい高さで区切る。図の上下も帯の境目に合わせる
  const bottomM = Math.floor(minM / intervalM) * intervalM
  const topM = Math.max(bottomM + intervalM, Math.ceil(maxM / intervalM) * intervalM)
  const count = Math.round((topM - bottomM) / intervalM)
  const bands = Array.from({ length: count }, (_, i) => ({
    fromM: bottomM + i * intervalM,
    toM: bottomM + (i + 1) * intervalM,
    color: reliefColor(count === 1 ? 0 : i / (count - 1)),
  }))
  const step = Math.max(1, Math.ceil(profile.length / MAX_POINTS))
  const pts = profile.filter((_, i) => i % step === 0 || i === profile.length - 1)
  type Scale = (v: number) => number
  const line = (x: Scale, y: Scale) =>
    pts
      .map(
        (p, i) =>
          `${i === 0 ? 'M' : 'L'}${x(p.distanceM).toFixed(1)} ${y(p.elevationM).toFixed(1)}`,
      )
      .join(' ')
  const area = (x: Scale, y: Scale) =>
    `${line(x, y)} L${x(totalM).toFixed(1)} ${HEIGHT} L0 ${HEIGHT} Z`
  return { totalM, minM, maxM, intervalM, bottomM, topM, bands, line, area }
}
