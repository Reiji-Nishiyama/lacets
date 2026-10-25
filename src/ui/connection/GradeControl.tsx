import { useEffect, useState } from 'react'
import { cwFromCda, DEFAULT_CDA_M2, DEFAULT_CRR } from '../../domain/physics/aero.ts'
import { gradeToPercent, percentToGrade } from '../../domain/units.ts'
import { DEFAULT_GRADE_RANGE } from '../../devices/ftms/FtmsTrainer.ts'
import { deviceActions, useDeviceStore } from '../../store/deviceStore.ts'
import { t } from '../i18n/index.ts'

/** 接続テスト用に勾配を手動で送るスライダー。走行時の勾配送信は RideEngine（M2）が行う */
export function GradeControl() {
  const trainer = useDeviceStore((s) => s.devices.trainer)
  const state = useDeviceStore((s) => s.trainerState)
  const range = useDeviceStore((s) => s.capabilities?.gradeRange) ?? DEFAULT_GRADE_RANGE
  const [grade, setGrade] = useState(0)

  useEffect(() => {
    if (!trainer || state !== 'connected') return
    trainer
      .setSimulation({
        windSpeedMps: 0,
        grade,
        crr: DEFAULT_CRR,
        cwKgPerM: cwFromCda(DEFAULT_CDA_M2),
      })
      .then(() => deviceActions.setManualGrade(grade))
      .catch(deviceActions.reportCommandError)
  }, [trainer, state, grade])

  const minPct = gradeToPercent(range.minGrade)
  const maxPct = gradeToPercent(range.maxGrade)

  return (
    <section className="device-block">
      <div className="panel-header">
        <h3>{t('grade.heading')}</h3>
        <span className="grade-value" data-testid="grade-value">
          {gradeToPercent(grade).toFixed(1)}
          {t('unit.percent')}
        </span>
      </div>
      <input
        type="range"
        aria-label={t('grade.label')}
        min={minPct}
        max={maxPct}
        step={0.5}
        value={gradeToPercent(grade)}
        disabled={state !== 'connected'}
        onChange={(e) => setGrade(percentToGrade(Number(e.target.value)))}
      />
      <p className="hint">{t('grade.range', { min: minPct.toFixed(1), max: maxPct.toFixed(1) })}</p>
    </section>
  )
}
