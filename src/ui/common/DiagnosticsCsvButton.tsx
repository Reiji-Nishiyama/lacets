import { useState } from 'react'
import { saveFile } from '../../platform/fileSave.ts'
import { diagnosticsFileName, rideDiagnosticsCsv } from '../../recording/diagnosticsCsv.ts'
import type { RecordedRide } from '../../recording/types.ts'
import { t } from '../i18n/index.ts'

/** 走行記録を分析用 CSV に書き出す（#7 キャリブレーション） */
export function DiagnosticsCsvButton({ ride }: { ride: RecordedRide }) {
  const [done, setDone] = useState(false)
  const run = async () => {
    const csv = rideDiagnosticsCsv(ride)
    const result = await saveFile(
      diagnosticsFileName('ride', ride.startedAtMs),
      new TextEncoder().encode(csv),
      'text/csv',
      'CSV',
    )
    setDone(result === 'saved')
  }
  return (
    <div className="actions">
      <button type="button" className="button-subtle" onClick={() => void run()}>
        {t('diagnostics.rideExport')}
      </button>
      {done && <span className="hint">{t('diagnostics.exported')}</span>}
    </div>
  )
}
