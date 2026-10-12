import { useRideStore } from '../../store/rideStore.ts'
import { FitExportButton } from '../common/FitExportButton.tsx'
import { t } from '../i18n/index.ts'
import { RideReportView } from '../report/RideReportView.tsx'
import { RideStatsView } from '../report/RideStatsView.tsx'

/** 走行後の結果・保存状態・区間比較・FIT の書き出し */
export function RideSummaryPanel() {
  const ride = useRideStore((s) => s.recordedRide)
  const saveState = useRideStore((s) => s.saveState)

  if (!ride) {
    return (
      <div className="panel summary" data-testid="ride-summary">
        <h3>{t('summary.title')}</h3>
        <p className="hint">{t('summary.noRecord')}</p>
      </div>
    )
  }
  return (
    <div className="panel summary" data-testid="ride-summary">
      <h3>{t('summary.title')}</h3>
      <RideStatsView ride={ride} />
      {saveState !== 'idle' && (
        <p
          className={saveState === 'failed' ? 'notice notice-error' : 'hint'}
          data-testid="summary-save-state"
        >
          {t(
            saveState === 'saving'
              ? 'summary.saving'
              : saveState === 'saved'
                ? 'summary.saved'
                : 'summary.saveFailed',
          )}
        </p>
      )}
      <FitExportButton ride={ride} />
      <RideReportView ride={ride} />
    </div>
  )
}
