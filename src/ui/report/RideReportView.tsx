import { useEffect, useState } from 'react'
import type { SegmentComparison } from '../../domain/ghost/report.ts'
import { formatDuration } from '../../domain/units.ts'
import type { RecordedRide } from '../../recording/types.ts'
import { buildRideReport, type RideReport } from '../../store/rideReport.ts'
import { formatDelta, formatGradePct, formatInt, formatKm } from '../format.ts'
import { t } from '../i18n/index.ts'

type Tab = 'km' | 'climb'

/** 走行後の区間比較（1 km ごと / 登り）。ゴーストがあれば並べて差を出す */
export function RideReportView({ ride }: { ride: RecordedRide }) {
  const [report, setReport] = useState<RideReport | null>(null)
  const [tab, setTab] = useState<Tab>('climb')

  useEffect(() => {
    let cancelled = false
    buildRideReport(ride)
      .then((r) => {
        if (cancelled) return
        setReport(r)
        if (r.climbs.length === 0) setTab('km')
      })
      .catch((e: unknown) => console.error('レポートを作れませんでした', e))
    return () => {
      cancelled = true
    }
  }, [ride])

  if (!report) return null
  const rows = tab === 'km' ? report.kilometers : report.climbs
  const hasGhost = report.ghostName !== null

  return (
    <section className="report" data-testid="ride-report">
      <h3>{t('report.title')}</h3>
      {hasGhost && <p className="hint">{t('report.withGhost', { name: report.ghostName! })}</p>}
      <div className="tabs report-tabs" role="tablist">
        {(['climb', 'km'] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            className={`tab${tab === k ? ' tab-active' : ''}`}
            onClick={() => setTab(k)}
          >
            {t(k === 'km' ? 'report.tab.km' : 'report.tab.climb')}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="hint">{t('report.noClimbs')}</p>
      ) : (
        <div className="table-scroll">
          <table className="report-table">
            <thead>
              <tr>
                <th rowSpan={2}>{t('report.segment')}</th>
                <th colSpan={hasGhost ? 3 : 1}>{t('report.time')}</th>
                <th colSpan={hasGhost ? 2 : 1}>
                  {t('report.power')}（{t('unit.watt')}）
                </th>
                <th colSpan={hasGhost ? 2 : 1}>{t('report.wkg')}</th>
              </tr>
              <tr>
                <th>{t('report.you')}</th>
                {hasGhost && <th>{t('report.ghost')}</th>}
                {hasGhost && <th>{t('report.delta')}</th>}
                <th>{t('report.you')}</th>
                {hasGhost && <th>{t('report.ghost')}</th>}
                <th>{t('report.you')}</th>
                {hasGhost && <th>{t('report.ghost')}</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <ReportRow key={i} row={row} hasGhost={hasGhost} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function segmentLabel(row: SegmentComparison): string {
  const { segment } = row
  const range = { from: formatKm(segment.startM), to: formatKm(segment.endM) }
  if (segment.kind === 'climb') {
    return t('report.climbLabel', { ...range, grade: formatGradePct(segment.averageGrade ?? 0) })
  }
  return t('report.kmLabel', range)
}

const time = (s: number | undefined) => (s === undefined ? '—' : formatDuration(s))
const wkg = (v: number | null | undefined) => (v == null ? '—' : v.toFixed(2))

function ReportRow({ row, hasGhost }: { row: SegmentComparison; hasGhost: boolean }) {
  const deltaClass =
    row.deltaS === null
      ? ''
      : row.deltaS < -0.5
        ? 'delta-ahead'
        : row.deltaS > 0.5
          ? 'delta-behind'
          : ''
  return (
    <tr>
      <td>{segmentLabel(row)}</td>
      <td>{time(row.user?.timeS)}</td>
      {hasGhost && <td>{time(row.ghost?.timeS)}</td>}
      {hasGhost && <td className={deltaClass}>{formatDelta(row.deltaS)}</td>}
      <td>{formatInt(row.user?.averagePowerW)}</td>
      {hasGhost && <td>{formatInt(row.ghost?.averagePowerW)}</td>}
      <td>{wkg(row.user?.wattsPerKg)}</td>
      {hasGhost && <td>{wkg(row.ghost?.wattsPerKg)}</td>}
    </tr>
  )
}
