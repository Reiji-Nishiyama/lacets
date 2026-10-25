import {
  trainerMassRatio,
  updateTrainerSettings,
  useSettingsStore,
} from '../../store/settingsStore.ts'
import { t } from '../i18n/index.ts'

/** トレーナーの負荷補正（#7）: トレーナーが想定している総重量 */
export function TrainerSettingsPanel() {
  const rider = useSettingsStore((s) => s.rider)
  const trainer = useSettingsStore((s) => s.trainer)
  const actual = rider.riderMassKg + rider.bikeMassKg
  return (
    <div className="panel settings" data-testid="trainer-settings">
      <h3>{t('settings.trainer')}</h3>
      <p className="hint">{t('settings.trainerHint')}</p>
      <label className="field">
        <span>{t('settings.trainerMass')}</span>
        <input
          type="number"
          min={30}
          max={200}
          step={0.1}
          value={trainer.assumedMassKg ?? ''}
          placeholder="—"
          onChange={(e) => {
            const v = e.target.value === '' ? null : Number(e.target.value)
            if (v === null || (Number.isFinite(v) && v >= 30 && v <= 200)) {
              updateTrainerSettings({ assumedMassKg: v })
            }
          }}
        />
        <span className="field-unit">{t('unit.kg')}</span>
        {trainer.assumedMassKg !== null && (
          <button
            type="button"
            className="button-subtle"
            onClick={() => updateTrainerSettings({ assumedMassKg: null })}
          >
            {t('settings.trainerNone')}
          </button>
        )}
      </label>
      {trainer.assumedMassKg !== null && (
        <p data-testid="trainer-ratio">
          {t('settings.trainerRatio', {
            ratio: trainerMassRatio(rider, trainer).toFixed(2),
            actual: actual.toFixed(1),
            trainer: trainer.assumedMassKg.toFixed(1),
          })}
        </p>
      )}
    </div>
  )
}
