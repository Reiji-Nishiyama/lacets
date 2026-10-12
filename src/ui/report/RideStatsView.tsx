import { formatDuration } from '../../domain/units.ts'
import type { RecordedRide } from '../../recording/types.ts'
import { Stat } from '../common/Stat.tsx'
import { formatInt, formatKm, formatMeters } from '../format.ts'
import { t } from '../i18n/index.ts'

export function RideStatsView({ ride }: { ride: RecordedRide }) {
  const { stats } = ride
  return (
    <div className="stats">
      <Stat
        label={t('metric.distance')}
        value={formatKm(stats.distanceM, 2)}
        unit={t('unit.km')}
        testId="summary-distance"
      />
      <Stat label={t('metric.elapsed')} value={formatDuration(stats.movingTimeS)} />
      <Stat
        label={t('summary.averagePower')}
        value={formatInt(stats.averagePowerW)}
        unit={t('unit.watt')}
      />
      <Stat label={t('summary.ascent')} value={formatMeters(stats.ascentM)} unit={t('unit.m')} />
    </div>
  )
}
