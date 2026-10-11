import { SimulatedTrainer } from '../../devices/sim/SimulatedTrainer.ts'
import { useDeviceStore } from '../../store/deviceStore.ts'
import { t } from '../i18n/index.ts'
import { GradeControl } from './GradeControl.tsx'
import { HeartRatePanel } from './HeartRatePanel.tsx'
import { SimulatorPanel } from './SimulatorPanel.tsx'
import { TrainerPanel } from './TrainerPanel.tsx'

export function ConnectionTestPage({ simulator }: { simulator: boolean }) {
  const trainer = useDeviceStore((s) => s.devices.trainer)
  const error = useDeviceStore((s) => s.error)

  return (
    <main className="page">
      <header className="page-header">
        <h1>{t('app.name')}</h1>
        <p className="subtitle">{t('connectionTest.title')}</p>
      </header>

      {simulator && <p className="notice">{t('connectionTest.simulatorNotice')}</p>}

      {!trainer && (
        <p className="notice notice-warn" role="alert">
          {t('connectionTest.unsupportedBrowser')}{' '}
          <a href="?sim=1">{t('connectionTest.trySimulator')}</a>
        </p>
      )}

      {error && (
        <p className="notice notice-error" role="alert">
          {t(error.kind === 'connectFailed' ? 'error.connectFailed' : 'error.commandFailed', {
            detail: error.detail,
          })}
        </p>
      )}

      {trainer && (
        <div className="panels">
          <TrainerPanel />
          <GradeControl />
          <HeartRatePanel />
          {trainer instanceof SimulatedTrainer && <SimulatorPanel trainer={trainer} />}
        </div>
      )}
    </main>
  )
}
