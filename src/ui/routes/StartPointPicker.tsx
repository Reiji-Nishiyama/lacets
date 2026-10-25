import type { Course } from '../../domain/course/Course.ts'
import { formatGradePct, formatKm, formatMeters } from '../format.ts'
import { t } from '../i18n/index.ts'

/** 開始地点を選ぶ間隔 [m] */
const STEP_M = 100
/** 終点の手前これだけは残す（すぐゴールにならないように）[m] */
const MIN_REMAINING_M = 200

/** ルートの任意の地点から走り始める（#5）。プロファイルをクリックしても選べる */
export function StartPointPicker({
  course,
  value,
  onChange,
}: {
  course: Course
  value: number
  onChange: (distanceM: number) => void
}) {
  const maxM = Math.max(0, Math.floor((course.distanceM - MIN_REMAINING_M) / STEP_M) * STEP_M)
  const p = course.positionAt(value)
  return (
    <div className="start-point" data-testid="start-point">
      <input
        type="range"
        aria-label={t('start.heading')}
        min={0}
        max={maxM}
        step={STEP_M}
        value={Math.min(value, maxM)}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="start-point-row">
        <p data-testid="start-point-value">
          {value > 0
            ? t('start.value', {
                km: formatKm(value),
                elevation: formatMeters(p.elevationM),
                grade: formatGradePct(p.grade),
                remaining: formatKm(course.distanceM - value),
              })
            : t('start.fromBeginning')}
        </p>
        {value > 0 && (
          <button type="button" className="button-subtle" onClick={() => onChange(0)}>
            {t('start.reset')}
          </button>
        )}
      </div>
    </div>
  )
}
