import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import type { ProfilePoint } from '../../domain/course/types.ts'
import { getRide } from '../../store/rideRepository.ts'
import { getRoute } from '../../store/routeRepository.ts'
import { DiagnosticsCsvButton } from '../common/DiagnosticsCsvButton.tsx'
import { FitExportButton } from '../common/FitExportButton.tsx'
import { RouteMap } from '../common/RouteMap.tsx'
import { formatDateTime } from '../format.ts'
import { t } from '../i18n/index.ts'
import { useNavigation } from '../navigation.ts'
import { RideReportView } from '../report/RideReportView.tsx'
import { RideStatsView } from '../report/RideStatsView.tsx'

/**
 * 履歴の 1 回分。事前確認と同じく、空の帯の上にルート名。白い面の上段は数字と書き出し（左）と
 * 走った軌跡の地図（右）、下段は区間比較
 */
export function RideDetailPage({ rideId }: { rideId: string }) {
  const ride = useLiveQuery(async () => (await getRide(rideId)) ?? null, [rideId])
  // ルートが削除されていれば null（軌跡だけを描く）
  const route = useLiveQuery(
    async () => (ride ? ((await getRoute(ride.routeId)) ?? null) : undefined),
    [ride],
  )
  const navigate = useNavigation((s) => s.navigate)
  const track = useMemo(() => ride?.samples ?? [], [ride])
  const profile = useMemo<readonly ProfilePoint[]>(
    () =>
      route?.profile ??
      track.map((s) => ({
        distanceM: s.distanceM,
        lat: s.lat,
        lon: s.lon,
        elevationM: s.elevationM,
        grade: s.grade,
      })),
    [route, track],
  )

  if (ride === undefined) return null
  if (ride === null) return <p className="notice notice-error">{t('history.notFound')}</p>

  return (
    <section>
      <div className="page-hero">
        <button type="button" className="back-pill" onClick={() => navigate({ name: 'history' })}>
          ← {t('history.title')}
        </button>
        <h2 className="page-hero-title">{ride.routeName}</h2>
        <p className="page-hero-subtitle">{formatDateTime(ride.startedAtMs)}</p>
      </div>
      <div className="sheet">
        <div className="ride-detail-top">
          <div>
            <RideStatsView ride={ride} />
            <div className="sheet-actions">
              <FitExportButton ride={ride} />
              <DiagnosticsCsvButton ride={ride} />
            </div>
          </div>
          {route !== undefined && profile.length >= 2 && (
            <div className="ride-detail-map" data-testid="ride-track-map">
              <RouteMap
                profile={profile}
                track={route ? track : undefined}
                relief
                className="map map-fill"
              />
            </div>
          )}
        </div>
        <RideReportView ride={ride} />
      </div>
    </section>
  )
}
