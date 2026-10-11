import { deviceActions, useDeviceStore } from '../../store/deviceStore.ts'
import { t } from '../i18n/index.ts'
import { ConnectionBadge } from './ConnectionBadge.tsx'

export function HeartRatePanel() {
  const state = useDeviceStore((s) => s.heartRateState)
  const name = useDeviceStore((s) => s.heartRateName)

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>{t('heartRate.heading')}</h2>
        <ConnectionBadge state={state} testId="heart-rate-state" />
      </div>
      {name && <p className="device-name">{name}</p>}
      <div className="actions">
        {state === 'disconnected' ? (
          <button type="button" onClick={() => void deviceActions.connectHeartRate()}>
            {t('heartRate.connect')}
          </button>
        ) : (
          <button
            type="button"
            disabled={state === 'connecting'}
            onClick={() => void deviceActions.disconnectHeartRate()}
          >
            {t('heartRate.disconnect')}
          </button>
        )}
      </div>
    </section>
  )
}
