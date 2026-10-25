import { useRef, useState } from 'react'
import { RouteParseError } from '../../domain/course/parsers/RouteParseError.ts'
import type { GhostRef } from '../../recording/types.ts'
import type { GhostOption } from '../../store/ghosts.ts'
import { addReferenceFromFile } from '../../store/referenceRepository.ts'
import { formatDuration } from '../../domain/units.ts'
import { formatDateTime, formatPercent } from '../format.ts'
import { t } from '../i18n/index.ts'

const keyOf = (ref: GhostRef | null) => (ref ? `${ref.kind}:${ref.id}` : '')

/**
 * 走行前にゴーストを選ぶ。実走データの追加もここから。走り切った記録にはタイムを、
 * 自己ベスト・実走ベストには ★ を付ける（選択肢は事前確認画面が読み込む）
 */
export function GhostPicker({
  options,
  value,
  onChange,
  onAdded,
}: {
  options: GhostOption[] | null
  value: GhostRef | null
  onChange: (ref: GhostRef | null) => void
  /** 実走データを追加したとき（選択肢を読み直す） */
  onAdded: () => void
}) {
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const addFile = async (file: File) => {
    setMessage(null)
    try {
      const ref = await addReferenceFromFile(file.name, new Uint8Array(await file.arrayBuffer()))
      setMessage({ kind: 'ok', text: t('ghost.added', { name: ref.name }) })
      onAdded()
      onChange({ kind: 'reference', id: ref.id })
    } catch (e) {
      console.warn(e)
      const text =
        e instanceof RouteParseError
          ? t(`routes.error.${e.code}`, { file: file.name })
          : t('routes.error.unknown', { file: file.name, detail: String(e) })
      setMessage({ kind: 'error', text })
    }
  }

  const selected = options?.find((o) => keyOf(o.ref) === keyOf(value))
  const label = (o: GhostOption) => {
    const date = formatDateTime(o.recordedAtMs)
    const time = o.fullTimeS === null ? null : formatDuration(o.fullTimeS)
    if (o.ref.kind === 'ride') {
      if (time === null) return t('ghost.optionRide', { date })
      return t(o.isBest ? 'ghost.optionRideBest' : 'ghost.optionRideTime', { date, time })
    }
    if (time === null) {
      return t('ghost.optionReference', {
        name: o.name,
        date,
        coverage: formatPercent(o.coverageRatio),
      })
    }
    return t(o.isBest ? 'ghost.optionReferenceBest' : 'ghost.optionReferenceTime', {
      name: o.name,
      date,
      time,
    })
  }

  return (
    <div className="ghost-picker">
      <div className="option-row">
        <label className="option-field">
          <span>{t('ghost.heading')}</span>
          <select
            aria-label={t('ghost.heading')}
            title={t('ghost.hint')}
            value={keyOf(value)}
            onChange={(e) => {
              const o = options?.find((x) => keyOf(x.ref) === e.target.value)
              onChange(o?.ref ?? null)
            }}
          >
            <option value="">{t('ghost.none')}</option>
            {options?.map((o) => (
              <option key={keyOf(o.ref)} value={keyOf(o.ref)}>
                {label(o)}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="button-subtle" onClick={() => inputRef.current?.click()}>
          {t('ghost.add')}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".fit,.gpx,.tcx"
          hidden
          data-testid="ghost-file-input"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void addFile(file)
          }}
        />
      </div>
      {selected && selected.coverageRatio < 0.95 && (
        <p className="notice notice-warn">
          {t('ghost.lowCoverage', { coverage: formatPercent(selected.coverageRatio) })}
        </p>
      )}
      {message && (
        <p
          className={message.kind === 'ok' ? 'notice' : 'notice notice-error'}
          role={message.kind === 'error' ? 'alert' : 'status'}
        >
          {message.text}
        </p>
      )}
    </div>
  )
}
