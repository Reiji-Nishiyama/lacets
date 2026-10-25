import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Course } from '../../domain/course/Course.ts'
import type { GhostRef } from '../../recording/types.ts'
import { deviceActions, useDeviceStore } from '../../store/deviceStore.ts'
import { loadGhost } from '../../store/ghosts.ts'
import { rideActions } from '../../store/rideStore.ts'
import { getRoute } from '../../store/routeRepository.ts'
import { routeVariant } from '../../store/routeVariant.ts'
import { trainerMassRatio, useSettingsStore } from '../../store/settingsStore.ts'
import { ElevationProfile } from '../common/ElevationProfile.tsx'
import { RouteMap } from '../common/RouteMap.tsx'
import { Stat } from '../common/Stat.tsx'
import { formatGradePct, formatKm, formatMeters } from '../format.ts'
import { t } from '../i18n/index.ts'
import { StreetImageCoverage } from '../media/StreetImageCoverage.tsx'
import { useNavigation } from '../navigation.ts'
import { GhostPicker } from './GhostPicker.tsx'
import { StartPointPicker } from './StartPointPicker.tsx'

/** 走行前の確認（地図・勾配プロファイル・統計）。向き（#6）と開始地点（#5）を選ぶ */
export function RoutePreviewPage({ routeId }: { routeId: string }) {
  // undefined = 読み込み中、null = 見つからない
  const route = useLiveQuery(async () => (await getRoute(routeId)) ?? null, [routeId])
  const navigate = useNavigation((s) => s.navigate)
  const devices = useDeviceStore((s) => s.devices)
  const trainerState = useDeviceStore((s) => s.trainerState)
  const rider = useSettingsStore((s) => s.rider)
  const trainerSettings = useSettingsStore((s) => s.trainer)
  const [reversed, setReversed] = useState(false)
  const [startM, setStartM] = useState(0)
  // undefined = 未選択（ルートに紐付いた実走データがあればそれを既定にする）
  const [ghostRef, setGhostRef] = useState<GhostRef | null | undefined>(undefined)
  const [starting, setStarting] = useState(false)
  const variant = useMemo(() => (route ? routeVariant(route, reversed) : null), [route, reversed])
  const course = useMemo(() => (variant ? new Course(variant.profile) : null), [variant])

  if (route === undefined) return null
  if (!variant || !course) return <p className="notice notice-error">{t('preview.notFound')}</p>

  // 実走から作ったルートの実走データは、順方向のときだけ既定のゴーストにする
  const effectiveGhost =
    ghostRef !== undefined
      ? ghostRef
      : variant.referenceRideId && !reversed
        ? { kind: 'reference' as const, id: variant.referenceRideId }
        : null

  const changeDirection = (next: boolean) => {
    setReversed(next)
    // 向きが変わると距離軸が変わるので、開始地点とゴーストの選択を戻す
    setStartM(0)
    setGhostRef(undefined)
  }

  const start = async () => {
    setStarting(true)
    try {
      const ghost = effectiveGhost ? await loadGhost(effectiveGhost, variant) : null
      rideActions.start(
        variant,
        devices,
        rider,
        ghost,
        startM,
        trainerMassRatio(rider, trainerSettings),
      )
      navigate({ name: 'ride' })
    } finally {
      setStarting(false)
    }
  }

  const { stats } = variant
  const startPosition = startM > 0 ? course.positionAt(startM) : undefined

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
        <h2 className="page-title">{variant.name}</h2>
      </div>
      <label className="field direction-toggle">
        <input
          type="checkbox"
          checked={reversed}
          onChange={(e) => changeDirection(e.target.checked)}
        />
        <span>{t('preview.reverse')}</span>
      </label>
      <div className="stats">
        <Stat
          label={t('stats.distance')}
          value={formatKm(stats.distanceM)}
          unit={t('unit.km')}
          testId="stat-distance"
        />
        <Stat
          label={t('stats.ascent')}
          value={formatMeters(stats.ascentM)}
          unit={t('unit.m')}
          testId="stat-ascent"
        />
        <Stat
          label={t('stats.descent')}
          value={formatMeters(stats.descentM)}
          unit={t('unit.m')}
          testId="stat-descent"
        />
        <Stat
          label={t('stats.maxGrade')}
          value={formatGradePct(stats.maxGrade)}
          unit={t('unit.percent')}
          testId="stat-max-grade"
        />
      </div>
      <p className="hint">{t(`preview.elevationSource.${variant.elevationSource}`)}</p>
      {!variant.hasElevation && <p className="notice notice-warn">{t('preview.noElevation')}</p>}
      {variant.steepSections.length > 0 && (
        <p className="notice notice-warn">
          {t('preview.steepSections', { count: variant.steepSections.length })}
        </p>
      )}
      <RouteMap profile={variant.profile} position={startPosition} />
      <ElevationProfile
        profile={variant.profile}
        startDistanceM={startM}
        onSelectDistance={(d) => setStartM(Math.round(d / 100) * 100)}
      />
      <StartPointPicker course={course} value={startM} onChange={setStartM} />
      <StreetImageCoverage route={variant} />
      <GhostPicker route={variant} value={effectiveGhost} onChange={setGhostRef} />
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
