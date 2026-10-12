import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { RouteParseError } from '../../domain/course/parsers/RouteParseError.ts'
import type { StoredRoute } from '../../store/db.ts'
import { addRouteFromFile, deleteRoute, listRoutes } from '../../store/routeRepository.ts'
import { formatGradePct, formatKm, formatMeters } from '../format.ts'
import { t } from '../i18n/index.ts'
import { useNavigation } from '../navigation.ts'
import { RouteDropZone } from './RouteDropZone.tsx'

interface ImportMessage {
  kind: 'ok' | 'error'
  text: string
}

function importErrorMessage(fileName: string, e: unknown): string {
  if (e instanceof RouteParseError) return t(`routes.error.${e.code}`, { file: fileName })
  return t('routes.error.unknown', {
    file: fileName,
    detail: e instanceof Error ? e.message : String(e),
  })
}

export function RoutesPage() {
  const routes = useLiveQuery(() => listRoutes(), [])
  const navigate = useNavigation((s) => s.navigate)
  const [messages, setMessages] = useState<ImportMessage[]>([])
  const [importing, setImporting] = useState(false)

  const importFiles = async (files: File[]) => {
    setImporting(true)
    const results: ImportMessage[] = []
    for (const file of files) {
      try {
        const route = await addRouteFromFile(file.name, new Uint8Array(await file.arrayBuffer()))
        results.push({ kind: 'ok', text: t('routes.imported', { name: route.name }) })
      } catch (e) {
        console.warn(e)
        results.push({ kind: 'error', text: importErrorMessage(file.name, e) })
      }
    }
    setMessages(results)
    setImporting(false)
  }

  const remove = async (route: StoredRoute) => {
    if (!confirm(t('routes.deleteConfirm', { name: route.name }))) return
    await deleteRoute(route.id)
  }

  return (
    <section>
      <h2 className="page-title">{t('routes.title')}</h2>
      <RouteDropZone onFiles={(files) => void importFiles(files)} busy={importing} />
      {messages.map((m, i) => (
        <p
          key={i}
          className={m.kind === 'ok' ? 'notice' : 'notice notice-error'}
          role={m.kind === 'error' ? 'alert' : 'status'}
        >
          {m.text}
        </p>
      ))}
      {routes && routes.length === 0 && <p className="hint">{t('routes.empty')}</p>}
      <ul className="route-list">
        {routes?.map((r) => (
          <li key={r.id} className="route-item">
            <button
              type="button"
              className="route-open"
              onClick={() => navigate({ name: 'preview', routeId: r.id })}
            >
              <span className="route-name">{r.name}</span>
              <span className="route-stats">
                {formatKm(r.stats.distanceM)} {t('unit.km')} ・ {t('stats.ascent')}{' '}
                {formatMeters(r.stats.ascentM)} {t('unit.m')} ・ {t('stats.maxGrade')}{' '}
                {formatGradePct(r.stats.maxGrade)}
                {t('unit.percent')}
              </span>
            </button>
            <button type="button" className="button-subtle" onClick={() => void remove(r)}>
              {t('routes.delete')}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
