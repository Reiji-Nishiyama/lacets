import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import type { GhostRef } from '../../recording/types.ts'
import { deviceActions, useDeviceStore } from '../../store/deviceStore.ts'
import { loadGhost } from '../../store/ghosts.ts'
import { rideActions } from '../../store/rideStore.ts'
import { getRoute } from '../../store/routeRepository.ts'
import { useSettingsStore } from '../../store/settingsStore.ts'
import { ElevationProfile } from '../common/ElevationProfile.tsx'
import { RouteMap } from '../common/RouteMap.tsx'
import { Stat } from '../common/Stat.tsx'
import { formatGradePct, formatKm, formatMeters } from '../format.ts'
import { t } from '../i18n/index.ts'
import { useNavigation } from '../navigation.ts'
import { GhostPicker } from './GhostPicker.tsx'

/** 走行前の確認（地図・勾配プロファイル・統計） */
export function RoutePreviewPage({ routeId }: { routeId: string }) {
  // undefined = 読み込み中、null = 見つからない
  const route = useLiveQuery(async () => (await getRoute(routeId)) ?? null, [routeId])
  const navigate = useNavigation((s) => s.navigate)
  const devices = useDeviceStore((s) => s.devices)
  const trainerState = useDeviceStore((s) => s.trainerState)
  const rider = useSettingsStore((s) => s.rider)
  // undefined = 未選択（ルートに紐付いた実走データがあればそれを既定にする）
  const [ghostRef, setGhostRef] = useState<GhostRef | null | undefined>(undefined)
  const [starting, setStarting] = useState(false)

  if (route === undefined) return null
  if (route === null) return <p className="notice notice-error">{t('preview.notFound')}</p>

  const effectiveGhost =
    ghostRef !== undefined
      ? ghostRef
      : route.referenceRideId
        ? { kind: 'reference' as const, id: route.referenceRideId }
        : null

  const start = async () => {
    setStarting(true)
    try {
      const ghost = effectiveGhost ? await loadGhost(effectiveGhost, route) : null
      rideActions.start(route, devices, rider, ghost)
      navigate({ name: 'ride' })
    } finally {
      setStarting(false)
    }
  }

  return (
    <section>
      <div className="page-title-row">
        <button
          type="button"
          className="button-subtle"
          onClick={() => navigate({ name: 'routes' })}
        >
          ← {t('nav.back')}
        </button>
        <h2 className="page-title">{route.name}</h2>
      </div>
      <div className="stats">
        <Stat
          label={t('stats.distance')}
          value={formatKm(route.stats.distanceM)}
          unit={t('unit.km')}
          testId="stat-distance"
        />
        <Stat
          label={t('stats.ascent')}
          value={formatMeters(route.stats.ascentM)}
          unit={t('unit.m')}
          testId="stat-ascent"
        />
        <Stat
          label={t('stats.descent')}
          value={formatMeters(route.stats.descentM)}
          unit={t('unit.m')}
        />
        <Stat
          label={t('stats.maxGrade')}
          value={formatGradePct(route.stats.maxGrade)}
          unit={t('unit.percent')}
          testId="stat-max-grade"
        />
      </div>
      <p className="hint">{t(`preview.elevationSource.${route.elevationSource}`)}</p>
      {!route.hasElevation && <p className="notice notice-warn">{t('preview.noElevation')}</p>}
      {route.steepSections.length > 0 && (
        <p className="notice notice-warn">
          {t('preview.steepSections', { count: route.steepSections.length })}
        </p>
      )}
      <RouteMap profile={route.profile} />
      <ElevationProfile profile={route.profile} />
      <GhostPicker route={route} value={effectiveGhost} onChange={setGhostRef} />
      <div className="actions">
        {trainerState === 'connected' ? (
          <button
            type="button"
            className="button-primary"
            disabled={starting}
            onClick={() => void start()}
          >
            {t('preview.start')}
          </button>
        ) : (
          <>
            <p className="hint">{t('preview.connectFirst')}</p>
            <button
              type="button"
              disabled={!devices.trainer || trainerState !== 'disconnected'}
              onClick={() => void deviceActions.connectTrainer()}
            >
              {t('trainer.connect')}
            </button>
          </>
        )}
      </div>
    </section>
  )
}
