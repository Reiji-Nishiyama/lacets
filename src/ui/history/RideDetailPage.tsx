import { useLiveQuery } from 'dexie-react-hooks'
import { getRide } from '../../store/rideRepository.ts'
import { DiagnosticsCsvButton } from '../common/DiagnosticsCsvButton.tsx'
import { FitExportButton } from '../common/FitExportButton.tsx'
import { formatDateTime } from '../format.ts'
import { t } from '../i18n/index.ts'
import { useNavigation } from '../navigation.ts'
import { RideReportView } from '../report/RideReportView.tsx'
import { RideStatsView } from '../report/RideStatsView.tsx'

/** 履歴の 1 回分。事前確認と同じく、空の帯の上にルート名、白い面に数字・書き出し・区間比較 */
export function RideDetailPage({ rideId }: { rideId: string }) {
  const ride = useLiveQuery(async () => (await getRide(rideId)) ?? null, [rideId])
  const navigate = useNavigation((s) => s.navigate)

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
        <RideStatsView ride={ride} />
        <div className="sheet-actions">
          <FitExportButton ride={ride} />
          <DiagnosticsCsvButton ride={ride} />
        </div>
        <RideReportView ride={ride} />
      </div>
    </section>
  )
}
