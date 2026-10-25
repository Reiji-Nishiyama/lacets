import {
  CDA_PRESETS_M2,
  CRR_PRESETS,
  type PositionPreset,
  type RoadSurface,
} from '../../domain/rider.ts'
import { updateRiderSettings, useSettingsStore } from '../../store/settingsStore.ts'
import { t } from '../i18n/index.ts'
import { MediaSettingsPanel } from './MediaSettingsPanel.tsx'
import { TrainerSettingsPanel } from './TrainerSettingsPanel.tsx'

const POSITIONS = Object.keys(CDA_PRESETS_M2) as PositionPreset[]
const SURFACES = Object.keys(CRR_PRESETS) as RoadSurface[]

function surfaceOf(crr: number): RoadSurface | 'custom' {
  return SURFACES.find((s) => Math.abs(CRR_PRESETS[s] - crr) < 1e-9) ?? 'custom'
}

function NumberField({
  label,
  value,
  unit,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  unit: string
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const v = Number(e.target.value)
          if (Number.isFinite(v) && v >= min && v <= max) onChange(v)
        }}
      />
      <span className="field-unit">{unit}</span>
    </label>
  )
}

export function SettingsPage() {
  const rider = useSettingsStore((s) => s.rider)

  return (
    <section>
      <h2 className="page-title">{t('settings.title')}</h2>
      <div className="panel settings">
        <NumberField
          label={t('settings.riderMass')}
          value={rider.riderMassKg}
          unit={t('unit.kg')}
          min={30}
          max={150}
          step={0.5}
          onChange={(riderMassKg) => updateRiderSettings({ riderMassKg })}
        />
        <NumberField
          label={t('settings.bikeMass')}
          value={rider.bikeMassKg}
          unit={t('unit.kg')}
          min={3}
          max={30}
          step={0.1}
          onChange={(bikeMassKg) => updateRiderSettings({ bikeMassKg })}
        />
        <label className="field">
          <span>{t('settings.position')}</span>
          <select
            value={rider.position}
            onChange={(e) => updateRiderSettings({ position: e.target.value as PositionPreset })}
          >
            {POSITIONS.map((p) => (
              <option key={p} value={p}>
                {t(`settings.position.${p}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t('settings.roadSurface')}</span>
          <select
            value={surfaceOf(rider.crr)}
            onChange={(e) => {
              const v = e.target.value as RoadSurface | 'custom'
              if (v !== 'custom') updateRiderSettings({ crr: CRR_PRESETS[v] })
            }}
          >
            {SURFACES.map((sf) => (
              <option key={sf} value={sf}>
                {t(`settings.roadSurface.${sf}`)}
              </option>
            ))}
            {surfaceOf(rider.crr) === 'custom' && (
              <option value="custom">{t('settings.roadSurface.custom', { crr: rider.crr })}</option>
            )}
          </select>
        </label>
        <label className="field">
          <span>
            {t('settings.difficulty')}: {Math.round(rider.difficulty * 100)}
            {t('unit.percent')}
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(rider.difficulty * 100)}
            onChange={(e) => updateRiderSettings({ difficulty: Number(e.target.value) / 100 })}
          />
        </label>
        <p className="hint">{t('settings.difficultyHint')}</p>
      </div>
      <TrainerSettingsPanel />
      <MediaSettingsPanel />
    </section>
  )
}
