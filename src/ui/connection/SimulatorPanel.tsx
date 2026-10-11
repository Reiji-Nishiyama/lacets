import { useState } from 'react'
import type { SimulatedRiderMode } from '../../devices/sim/simulatedRider.ts'
import type { SimulatedTrainer } from '../../devices/sim/SimulatedTrainer.ts'
import { useDeviceStore } from '../../store/deviceStore.ts'
import { t } from '../i18n/index.ts'

export function SimulatorPanel({ trainer }: { trainer: SimulatedTrainer }) {
  const state = useDeviceStore((s) => s.trainerState)
  const [settings, setSettings] = useState(trainer.settings)

  const update = (patch: Partial<typeof settings>) => {
    trainer.setSettings(patch)
    setSettings(trainer.settings)
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>{t('simulator.heading')}</h2>
      </div>
      <label className="field">
        <span>{t('simulator.mode')}</span>
        <select
          value={settings.mode}
          onChange={(e) => update({ mode: e.target.value as SimulatedRiderMode })}
        >
          <option value="grade">{t('simulator.mode.grade')}</option>
          <option value="fixed">{t('simulator.mode.fixed')}</option>
        </select>
      </label>
      <label className="field">
        <span>
          {t('simulator.basePower')}: {settings.basePowerW} {t('unit.watt')}
        </span>
        <input
          type="range"
          min={50}
          max={500}
          step={5}
          value={settings.basePowerW}
          onChange={(e) => update({ basePowerW: Number(e.target.value) })}
        />
      </label>
      <label className="field">
        <span>
          {t('simulator.cadence')}: {settings.baseCadenceRpm} {t('unit.rpm')}
        </span>
        <input
          type="range"
          min={50}
          max={120}
          step={1}
          value={settings.baseCadenceRpm}
          onChange={(e) => update({ baseCadenceRpm: Number(e.target.value) })}
        />
      </label>
      <div className="actions">
        <button
          type="button"
          disabled={state !== 'connected'}
          onClick={() => trainer.simulateDropout()}
        >
          {t('simulator.dropout')}
        </button>
      </div>
    </section>
  )
}
