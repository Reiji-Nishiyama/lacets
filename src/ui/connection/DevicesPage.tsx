import { SimulatedTrainer } from '../../devices/sim/SimulatedTrainer.ts'
import { useDeviceStore } from '../../store/deviceStore.ts'
import { t } from '../i18n/index.ts'
import { GradeControl } from './GradeControl.tsx'
import { GradeTestRecorder } from './GradeTestRecorder.tsx'
import { HeartRatePanel } from './HeartRatePanel.tsx'
import { SimulatorPanel } from './SimulatorPanel.tsx'
import { TrainerPanel } from './TrainerPanel.tsx'

/**
 * デバイス（docs/07-design.md）。上の白い面にトレーナー（大きな数字と「トレーナーに接続」）と心拍計、
 * 下の白い面に負荷のテスト（勾配を手で送る・記録して補正する）とシミュレータの設定
 */
export function DevicesPage() {
  const trainer = useDeviceStore((s) => s.devices.trainer)

  return (
    <section>
      <div className="page-hero">
        <h2 className="page-hero-title">{t('devices.title')}</h2>
        <p className="page-hero-subtitle">{t('devices.subtitle')}</p>
      </div>
      {!trainer && (
        <p className="notice notice-warn" role="alert">
          {t('devices.unsupportedBrowser')} <a href="?sim=1">{t('devices.trySimulator')}</a>
        </p>
      )}
      {trainer && (
        <>
          <div className="sheet devices-sheet">
            <TrainerPanel />
            <HeartRatePanel />
          </div>
          <h3 className="sheet-heading">{t('devices.testHeading')}</h3>
          <div className="sheet">
            <p className="hint sheet-lead">{t('devices.testHint')}</p>
            <div className="devices-tests">
              <GradeControl />
              <GradeTestRecorder />
            </div>
          </div>
          {trainer instanceof SimulatedTrainer && (
            <div className="sheet sheet-quiet">
              <SimulatorPanel trainer={trainer} />
            </div>
          )}
        </>
      )}
    </section>
  )
}
