import { deviceActions, selectHeartRateBpm, useDeviceStore } from '../../store/deviceStore.ts'
import { t } from '../i18n/index.ts'
import { ConnectionBadge } from './ConnectionBadge.tsx'
import { Metric } from './Metric.tsx'

export function TrainerPanel() {
  const state = useDeviceStore((s) => s.trainerState)
  const name = useDeviceStore((s) => s.trainerName)
  const data = useDeviceStore((s) => s.trainerData)
  const capabilities = useDeviceStore((s) => s.capabilities)
  const heartRateBpm = useDeviceStore(selectHeartRateBpm)

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>{t('trainer.heading')}</h2>
        <ConnectionBadge state={state} testId="trainer-state" />
      </div>
      {name && <p className="device-name">{name}</p>}
      <div className="metrics">
        <Metric
          label={t('metric.power')}
          value={data?.powerW}
          unit={t('unit.watt')}
          testId="power"
        />
        <Metric
          label={t('metric.cadence')}
          value={data?.cadenceRpm}
          unit={t('unit.rpm')}
          testId="cadence"
        />
        <Metric
          label={t('metric.heartRate')}
          value={heartRateBpm}
          unit={t('unit.bpm')}
          testId="heart-rate"
        />
      </div>
      {capabilities && !capabilities.simulationSupported && (
        <p className="notice notice-warn">{t('trainer.simulationUnsupported')}</p>
      )}
      <div className="actions">
        {state === 'disconnected' ? (
          <button type="button" onClick={() => void deviceActions.connectTrainer()}>
            {t('trainer.connect')}
          </button>
        ) : (
          <button
            type="button"
            disabled={state === 'connecting'}
            onClick={() => void deviceActions.disconnectTrainer()}
          >
            {t('trainer.disconnect')}
          </button>
        )}
      </div>
    </section>
  )
}
