import { useEffect, useRef, useState } from 'react'
import { RouteParseError } from '../../domain/course/parsers/RouteParseError.ts'
import type { GhostRef } from '../../recording/types.ts'
import type { StoredRoute } from '../../store/db.ts'
import { listGhostOptions, type GhostOption } from '../../store/ghosts.ts'
import { addReferenceFromFile } from '../../store/referenceRepository.ts'
import { formatDateTime, formatPercent } from '../format.ts'
import { t } from '../i18n/index.ts'

const keyOf = (ref: GhostRef | null) => (ref ? `${ref.kind}:${ref.id}` : '')

/** 走行前にゴーストを選ぶ。実走データの追加もここから */
export function GhostPicker({
  route,
  value,
  onChange,
}: {
  route: StoredRoute
  value: GhostRef | null
  onChange: (ref: GhostRef | null) => void
}) {
  const [options, setOptions] = useState<GhostOption[] | null>(null)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [reload, setReload] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    void listGhostOptions(route).then((opts) => {
      if (!cancelled) setOptions(opts)
    })
    return () => {
      cancelled = true
    }
  }, [route, reload])

  const addFile = async (file: File) => {
    setMessage(null)
    try {
      const ref = await addReferenceFromFile(file.name, new Uint8Array(await file.arrayBuffer()))
      setMessage({ kind: 'ok', text: t('ghost.added', { name: ref.name }) })
      setReload((n) => n + 1)
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
  const label = (o: GhostOption) =>
    o.ref.kind === 'ride'
      ? t('ghost.optionRide', { date: formatDateTime(o.recordedAtMs) })
      : t('ghost.optionReference', {
          name: o.name,
          date: formatDateTime(o.recordedAtMs),
          coverage: formatPercent(o.coverageRatio),
        })

  return (
    <section className="panel ghost-picker">
      <h3>{t('ghost.heading')}</h3>
      <p className="hint">{t('ghost.hint')}</p>
      <div className="actions">
        <select
          aria-label={t('ghost.heading')}
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
    </section>
  )
}
