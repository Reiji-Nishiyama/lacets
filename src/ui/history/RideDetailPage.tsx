import { useLiveQuery } from 'dexie-react-hooks'
import { getRide } from '../../store/rideRepository.ts'
import { FitExportButton } from '../common/FitExportButton.tsx'
import { formatDateTime } from '../format.ts'
import { t } from '../i18n/index.ts'
import { useNavigation } from '../navigation.ts'
import { RideReportView } from '../report/RideReportView.tsx'
import { RideStatsView } from '../report/RideStatsView.tsx'

export function RideDetailPage({ rideId }: { rideId: string }) {
  const ride = useLiveQuery(async () => (await getRide(rideId)) ?? null, [rideId])
  const navigate = useNavigation((s) => s.navigate)

  if (ride === undefined) return null
  if (ride === null) return <p className="notice notice-error">{t('history.notFound')}</p>

  return (
    <section>
      <div className="page-title-row">
        <button
          type="button"
          className="button-subtle"
          onClick={() => navigate({ name: 'history' })}
        >
          ← {t('nav.back')}
        </button>
        <h2 className="page-title">
          {formatDateTime(ride.startedAtMs)} {ride.routeName}
        </h2>
      </div>
      <RideStatsView ride={ride} />
      <FitExportButton ride={ride} />
      <RideReportView ride={ride} />
    </section>
  )
}
