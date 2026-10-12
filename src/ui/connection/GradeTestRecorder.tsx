import { useMemo, useState } from 'react'
import { estimateTrainerMass } from '../../domain/calibration/trainerMass.ts'
import { cwFromCda, DEFAULT_CDA_M2, DEFAULT_CRR } from '../../domain/physics/aero.ts'
import { useDeviceStore } from '../../store/deviceStore.ts'
import { manualTestActions, useManualTestStore } from '../../store/manualTestStore.ts'
import {
  trainerMassRatio,
  updateTrainerSettings,
  useSettingsStore,
} from '../../store/settingsStore.ts'
import { t } from '../i18n/index.ts'

/**
 * デバイス画面の勾配テストを記録して CSV に書き出す。記録から、トレーナーが想定している総重量を
 * 推定し、負荷の補正に使える（#7 キャリブレーション）
 */
export function GradeTestRecorder() {
  const recording = useManualTestStore((s) => s.recording)
  const samples = useManualTestStore((s) => s.samples)
  const connected = useDeviceStore((s) => s.trainerState === 'connected')
  const count = samples.length

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>{t('diagnostics.heading')}</h2>
      </div>
      <p className="hint">{t('diagnostics.hint')}</p>
      <div className="actions">
        {recording ? (
          <button type="button" onClick={manualTestActions.stop}>
            {t('diagnostics.stop')}
          </button>
        ) : (
          <button type="button" disabled={!connected} onClick={manualTestActions.start}>
            {t('diagnostics.start')}
          </button>
        )}
        <button
          type="button"
          className="button-subtle"
          disabled={recording || count === 0}
          onClick={() => void manualTestActions.exportCsv()}
        >
          {t('diagnostics.export')}
        </button>
        {count > 0 && (
          <span className="hint" data-testid="grade-test-count">
            {t('diagnostics.count', { count })}
          </span>
        )}
      </div>
      {!recording && count > 0 && <TrainerMassEstimate samples={samples} />}
    </section>
  )
}

function TrainerMassEstimate({
  samples,
}: {
  samples: ReturnType<typeof useManualTestStore.getState>['samples']
}) {
  const rider = useSettingsStore((s) => s.rider)
  const [applied, setApplied] = useState(false)
  // 勾配スライダー（GradeControl）が送っている既定の Crr・CdA で逆算する
  const estimate = useMemo(
    () => estimateTrainerMass(samples, { crr: DEFAULT_CRR, cwKgPerM: cwFromCda(DEFAULT_CDA_M2) }),
    [samples],
  )
  if (!estimate) {
    return <p className="hint">{t('calibration.notEnough')}</p>
  }
  const actual = rider.riderMassKg + rider.bikeMassKg
  const trainer = Math.round(estimate.massKg * 10) / 10
  const apply = () => {
    updateTrainerSettings({ assumedMassKg: trainer })
    setApplied(true)
  }
  return (
    <div className="calibration-result" data-testid="trainer-mass-estimate">
      <p>
        {t('calibration.estimate', {
          trainer: trainer.toFixed(1),
          actual: actual.toFixed(1),
          factor: (trainer / actual).toFixed(2),
        })}
      </p>
      <div className="actions">
        <button type="button" onClick={apply}>
          {t('calibration.apply')}
        </button>
        {applied && (
          <span className="hint" role="status">
            {t('calibration.applied', {
              ratio: trainerMassRatio(rider, { assumedMassKg: trainer }).toFixed(2),
            })}
          </span>
        )}
      </div>
    </div>
  )
}
