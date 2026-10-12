import { SimulatedTrainer } from '../../devices/sim/SimulatedTrainer.ts'
import { useDeviceStore } from '../../store/deviceStore.ts'
import { t } from '../i18n/index.ts'
import { GradeControl } from './GradeControl.tsx'
import { HeartRatePanel } from './HeartRatePanel.tsx'
import { SimulatorPanel } from './SimulatorPanel.tsx'
import { TrainerPanel } from './TrainerPanel.tsx'

/** トレーナー・心拍計の接続と、勾配を手動で送る接続テスト */
export function DevicesPage() {
  const trainer = useDeviceStore((s) => s.devices.trainer)

  return (
    <section>
      <h2 className="page-title">{t('devices.title')}</h2>
      {!trainer && (
        <p className="notice notice-warn" role="alert">
          {t('devices.unsupportedBrowser')} <a href="?sim=1">{t('devices.trySimulator')}</a>
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
    </section>
  )
}
