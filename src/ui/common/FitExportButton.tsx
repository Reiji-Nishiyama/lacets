import { useState } from 'react'
import type { RecordedRide } from '../../recording/types.ts'
import { exportRideFit } from '../../store/rideStore.ts'
import { t } from '../i18n/index.ts'

/** 走行記録を FIT ファイルに書き出すボタンと結果の表示 */
export function FitExportButton({ ride }: { ride: RecordedRide }) {
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async () => {
    setBusy(true)
    setMessage(null)
    try {
      if ((await exportRideFit(ride)) === 'saved') {
        setMessage({ kind: 'ok', text: t('summary.exported') })
      }
    } catch (e) {
      console.error(e)
      const detail = e instanceof Error ? e.message : String(e)
      setMessage({ kind: 'error', text: t('summary.exportFailed', { detail }) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="actions">
        <button type="button" disabled={busy} onClick={() => void run()}>
          {t('summary.exportFit')}
        </button>
      </div>
      {message && (
        <p
          className={message.kind === 'ok' ? 'notice' : 'notice notice-error'}
          role={message.kind === 'error' ? 'alert' : 'status'}
        >
          {message.text}
        </p>
      )}
    </>
  )
}
