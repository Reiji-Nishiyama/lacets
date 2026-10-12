import { useState } from 'react'
import { formatDuration } from '../../domain/units.ts'
import { rideActions, useRideStore } from '../../store/rideStore.ts'
import { Stat } from '../common/Stat.tsx'
import { formatInt, formatKm, formatMeters } from '../format.ts'
import { t } from '../i18n/index.ts'

type ExportMessage = { kind: 'ok' | 'error'; text: string } | null

/** 走行後の結果と FIT の書き出し */
export function RideSummaryPanel() {
  const ride = useRideStore((s) => s.recordedRide)
  const saveState = useRideStore((s) => s.saveState)
  const [message, setMessage] = useState<ExportMessage>(null)
  const [exporting, setExporting] = useState(false)

  const exportFit = async () => {
    setExporting(true)
    setMessage(null)
    try {
      const result = await rideActions.exportFit()
      if (result === 'saved') setMessage({ kind: 'ok', text: t('summary.exported') })
    } catch (e) {
      console.error(e)
      const detail = e instanceof Error ? e.message : String(e)
      setMessage({ kind: 'error', text: t('summary.exportFailed', { detail }) })
    } finally {
      setExporting(false)
    }
  }

  if (!ride) {
    return (
      <div className="panel summary" data-testid="ride-summary">
        <h3>{t('summary.title')}</h3>
        <p className="hint">{t('summary.noRecord')}</p>
      </div>
    )
  }
  const { stats } = ride
  return (
    <div className="panel summary" data-testid="ride-summary">
      <h3>{t('summary.title')}</h3>
      <div className="stats">
        <Stat
          label={t('metric.distance')}
          value={formatKm(stats.distanceM, 2)}
          unit={t('unit.km')}
          testId="summary-distance"
        />
        <Stat label={t('metric.elapsed')} value={formatDuration(stats.movingTimeS)} />
        <Stat
          label={t('summary.averagePower')}
          value={formatInt(stats.averagePowerW)}
          unit={t('unit.watt')}
        />
        <Stat label={t('summary.ascent')} value={formatMeters(stats.ascentM)} unit={t('unit.m')} />
      </div>
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
      <div className="actions">
        <button type="button" disabled={exporting} onClick={() => void exportFit()}>
          {t('summary.exportFit')}
        </button>
      </div>
      {message && (
        <p
          className={message.kind === 'ok' ? 'notice' : 'notice notice-error'}
          role={message.kind === 'error' ? 'alert' : 'status'}
        >
          {message.text}
        </p>
      )}
    </div>
  )
}
