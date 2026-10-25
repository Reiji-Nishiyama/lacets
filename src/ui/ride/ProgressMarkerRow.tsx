import { passedMarkers, type ProgressMarkers } from '../../domain/course/progressMarkers.ts'
import { t } from '../i18n/index.ts'

/** 印の列: 越えた印は濃い緑、次の印は太陽の黄色、まだの印は薄い緑 */
export function ProgressMarkerRow({
  markers,
  distanceM,
}: {
  markers: ProgressMarkers
  distanceM: number
}) {
  const total = markers.positionsM.length
  if (total === 0) return null
  const passed = passedMarkers(markers, distanceM)
  const label =
    markers.kind === 'hairpin'
      ? t('ride.marker.hairpin')
      : markers.kind === 'elevation'
        ? t('ride.marker.elevation', { step: markers.stepM })
        : t('ride.marker.distance', { step: markers.stepM / 1000 })
  return (
    <div className="marker-row">
      <span className="marker-label">{label}</span>
      <div
        className="marker-dots"
        role="img"
        aria-label={t('ride.marker.aria', { label, passed, total })}
        style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
        data-testid="marker-row"
        data-passed={passed}
        data-total={total}
      >
        {markers.positionsM.map((d, i) => (
          <span
            key={d}
            className={
              i < passed ? 'marker-dot passed' : i === passed ? 'marker-dot next' : 'marker-dot'
            }
          />
        ))}
      </div>
      <span className="marker-label">{t('ride.marker.remaining', { count: total - passed })}</span>
    </div>
  )
}
