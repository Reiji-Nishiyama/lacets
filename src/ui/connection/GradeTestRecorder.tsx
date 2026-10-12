import { manualTestActions, useManualTestStore } from '../../store/manualTestStore.ts'
import { useDeviceStore } from '../../store/deviceStore.ts'
import { t } from '../i18n/index.ts'

/** デバイス画面の勾配テストを記録して CSV に書き出す（#7 キャリブレーション） */
export function GradeTestRecorder() {
  const recording = useManualTestStore((s) => s.recording)
  const count = useManualTestStore((s) => s.samples.length)
  const connected = useDeviceStore((s) => s.trainerState === 'connected')

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
    </section>
  )
}
