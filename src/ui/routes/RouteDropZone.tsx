import { useRef, useState, type DragEvent } from 'react'
import { t } from '../i18n/index.ts'

/** ファイルのドラッグ＆ドロップ、またはファイル選択でルートを取り込む */
export function RouteDropZone({
  onFiles,
  busy,
}: {
  onFiles: (files: File[]) => void
  busy: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) onFiles(files)
  }

  return (
    <div
      className={`drop-zone${over ? ' drop-zone-over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <p>{busy ? t('routes.importing') : t('routes.drop')}</p>
      <button type="button" disabled={busy} onClick={() => inputRef.current?.click()}>
        {t('routes.choose')}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".gpx,.tcx,.fit"
        multiple
        hidden
        data-testid="route-file-input"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          e.target.value = ''
          if (files.length > 0) onFiles(files)
        }}
      />
    </div>
  )
}
