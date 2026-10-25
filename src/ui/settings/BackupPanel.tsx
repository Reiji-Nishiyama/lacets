import { useRef, useState } from 'react'
import { saveFile } from '../../platform/fileSave.ts'
import {
  backupFileName,
  BackupFormatError,
  createBackup,
  decodeBackup,
  encodeBackup,
  restoreBackup,
} from '../../store/backup.ts'
import { reloadSettings } from '../../store/settingsStore.ts'
import { t } from '../i18n/index.ts'

interface Message {
  kind: 'ok' | 'error'
  text: string
}

const detailOf = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** 端末の引っ越し用のバックアップの書き出しと取り込み（M6） */
export function BackupPanel() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<Message | null>(null)

  const exportBackup = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const now = Date.now()
      const backup = await createBackup(undefined, now)
      const result = await saveFile(
        backupFileName(now),
        await encodeBackup(backup),
        'application/gzip',
        t('backup.heading'),
      )
      if (result === 'saved') {
        setMessage({
          kind: 'ok',
          text: t('backup.exported', {
            routes: backup.routes.length,
            rides: backup.rides.length,
          }),
        })
      }
    } catch (e) {
      console.warn(e)
      setMessage({ kind: 'error', text: t('backup.exportFailed', { detail: detailOf(e) }) })
    } finally {
      setBusy(false)
    }
  }

  const importBackup = async (file: File) => {
    setBusy(true)
    setMessage(null)
    try {
      const backup = await decodeBackup(new Uint8Array(await file.arrayBuffer()))
      const counts = {
        routes: backup.routes.length,
        rides: backup.rides.length,
        referenceRides: backup.referenceRides.length,
      }
      if (!confirm(t('backup.importConfirm', counts))) return
      await restoreBackup(backup)
      await reloadSettings()
      setMessage({ kind: 'ok', text: t('backup.imported', counts) })
    } catch (e) {
      console.warn(e)
      setMessage({
        kind: 'error',
        text:
          e instanceof BackupFormatError
            ? t(`backup.error.${e.code}`)
            : t('backup.error.unknown', { detail: detailOf(e) }),
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="settings-section" data-testid="backup">
      <div className="settings-intro">
        <h3>{t('backup.heading')}</h3>
        <p className="hint">{t('backup.hint')}</p>
      </div>
      <div className="settings-fields">
        <div className="actions">
          <button type="button" disabled={busy} onClick={() => void exportBackup()}>
            {t('backup.export')}
          </button>
          <button
            type="button"
            className="button-subtle"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {t('backup.import')}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".gz,.json,application/gzip,application/json"
            hidden
            data-testid="backup-file-input"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) void importBackup(file)
            }}
          />
        </div>
        {message && (
          <p
            className={message.kind === 'ok' ? 'notice' : 'notice notice-error'}
            role={message.kind === 'error' ? 'alert' : 'status'}
          >
            {message.text}
          </p>
        )}
      </div>
    </section>
  )
}
