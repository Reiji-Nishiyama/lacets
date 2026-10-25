import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { RouteParseError } from '../../domain/course/parsers/RouteParseError.ts'
import { progressMarkers } from '../../domain/course/progressMarkers.ts'
import type { StoredRoute } from '../../store/db.ts'
import { addRouteFromFile, deleteRoute, listRoutes } from '../../store/routeRepository.ts'
import { formatGradePct, formatKm, formatMeters } from '../format.ts'
import { t } from '../i18n/index.ts'
import { useNavigation } from '../navigation.ts'
import { RouteDropZone } from './RouteDropZone.tsx'
import { RouteThumbnail } from './RouteThumbnail.tsx'

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

/**
 * ルート一覧（docs/07-design.md）。取り込んだルートを、形の絵と数字のチップのカードで並べる。
 * 先頭のタイルが新しいルートの取り込み口
 */
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
      <div className="page-hero">
        <h2 className="page-hero-title">{t('routes.title')}</h2>
        <p className="page-hero-subtitle">{t('routes.subtitle')}</p>
      </div>
      {messages.map((m, i) => (
        <p
          key={i}
          className={m.kind === 'ok' ? 'notice' : 'notice notice-error'}
          role={m.kind === 'error' ? 'alert' : 'status'}
        >
          {m.text}
        </p>
      ))}
      <ul className="route-grid">
        <li className="route-add">
          <h3>{t('routes.addHeading')}</h3>
          <RouteDropZone onFiles={(files) => void importFiles(files)} busy={importing} />
        </li>
        {routes?.map((r) => (
          <RouteCard
            key={r.id}
            route={r}
            onOpen={() => navigate({ name: 'preview', routeId: r.id })}
            onDelete={() => void remove(r)}
          />
        ))}
      </ul>
      {routes && routes.length === 0 && <p className="hint">{t('routes.empty')}</p>}
    </section>
  )
}

function RouteCard({
  route,
  onOpen,
  onDelete,
}: {
  route: StoredRoute
  onOpen: () => void
  onDelete: () => void
}) {
  const { stats, profile } = route
  const markers = progressMarkers(profile)
  return (
    <li className="route-card">
      <button type="button" className="route-card-open" onClick={onOpen}>
        <span className="route-card-picture">
          <RouteThumbnail profile={profile} />
          {markers.kind === 'hairpin' && (
            <span className="route-card-badge">
              {t('routes.hairpins', { count: markers.positionsM.length })}
            </span>
          )}
        </span>
        <span className="route-card-name">{route.name}</span>
        <span className="chips">
          <span className="chip chip-small">
            <strong>{formatKm(stats.distanceM)}</strong> {t('unit.km')}
          </span>
          <span className="chip chip-small">
            {t('chip.ascent')} <strong>{formatMeters(stats.ascentM)}</strong> {t('unit.m')}
          </span>
          <span className="chip chip-small">
            {t('chip.maxGrade')} <strong>{formatGradePct(stats.maxGrade)}</strong>
            {t('unit.percent')}
          </span>
        </span>
      </button>
      <button type="button" className="button-subtle route-card-delete" onClick={onDelete}>
        {t('routes.delete')}
      </button>
    </li>
  )
}
