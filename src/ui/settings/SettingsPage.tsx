import {
  CDA_PRESETS_M2,
  CRR_PRESETS,
  type PositionPreset,
  type RoadSurface,
} from '../../domain/rider.ts'
import { updateRiderSettings, useSettingsStore } from '../../store/settingsStore.ts'
import { t } from '../i18n/index.ts'
import { BackupPanel } from './BackupPanel.tsx'
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

/**
 * 設定（docs/07-design.md）。1 枚の白い面を話題ごとの段に分け、左に見出しと説明、右に項目を置く
 */
export function SettingsPage() {
  const rider = useSettingsStore((s) => s.rider)

  return (
    <section>
      <div className="page-hero">
        <h2 className="page-hero-title">{t('settings.title')}</h2>
        <p className="page-hero-subtitle">{t('settings.subtitle')}</p>
      </div>
      <div className="sheet settings-sheet">
        <section className="settings-section">
          <div className="settings-intro">
            <h3>{t('settings.rider')}</h3>
            <p className="hint">{t('settings.riderHint')}</p>
          </div>
          <div className="settings-fields">
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
                onChange={(e) =>
                  updateRiderSettings({ position: e.target.value as PositionPreset })
                }
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
                  <option value="custom">
                    {t('settings.roadSurface.custom', { crr: rider.crr })}
                  </option>
                )}
              </select>
            </label>
          </div>
        </section>
        <section className="settings-section">
          <div className="settings-intro">
            <h3>{t('settings.difficulty')}</h3>
            <p className="hint">{t('settings.difficultyHint')}</p>
          </div>
          <div className="settings-fields">
            <label className="field field-range">
              <span>
                {t('settings.difficulty')}{' '}
                <strong className="field-value">
                  {Math.round(rider.difficulty * 100)}
                  {t('unit.percent')}
                </strong>
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
          </div>
        </section>
        <TrainerSettingsPanel />
        <MediaSettingsPanel />
        <BackupPanel />
      </div>
    </section>
  )
}
