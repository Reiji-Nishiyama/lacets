import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Course } from '../../domain/course/Course.ts'
import { progressMarkers } from '../../domain/course/progressMarkers.ts'
import type { GhostRef } from '../../recording/types.ts'
import { deviceActions, useDeviceStore } from '../../store/deviceStore.ts'
import { loadGhost } from '../../store/ghosts.ts'
import { rideActions } from '../../store/rideStore.ts'
import { getRoute } from '../../store/routeRepository.ts'
import { routeVariant } from '../../store/routeVariant.ts'
import { trainerMassRatio, useSettingsStore } from '../../store/settingsStore.ts'
import { ElevationProfile } from '../common/ElevationProfile.tsx'
import { RouteMap } from '../common/RouteMap.tsx'
import { formatGradePct, formatKm, formatMeters } from '../format.ts'
import { t } from '../i18n/index.ts'
import { StreetImageCoverage } from '../media/StreetImageCoverage.tsx'
import { useNavigation } from '../navigation.ts'
import { ProgressMarkerRow } from '../ride/ProgressMarkerRow.tsx'
import { GhostPicker } from './GhostPicker.tsx'
import { StartPointPicker } from './StartPointPicker.tsx'

/**
 * 走行前の確認（docs/07-design.md の統合案）。空の帯の上にルート名、その下の白い面を
 * 「情報（左）」と「出発（右）」に分ける。右は地図と、その真下の幅いっぱいの「走りはじめる」だけ。
 * 向き（#6）と開始地点（#5）、ゴーストもここで選ぶ
 */
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
  const markers = useMemo(() => (variant ? progressMarkers(variant.profile) : null), [variant])

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

  const { stats, profile } = variant
  const startPosition = startM > 0 ? course.positionAt(startM) : undefined
  const fromM = profile[0]?.elevationM ?? 0
  const toM = profile[profile.length - 1]?.elevationM ?? 0

  return (
    <section className="preview">
      <div className="preview-hero">
        <button type="button" className="back-pill" onClick={() => navigate({ name: 'routes' })}>
          ← {t('preview.back')}
        </button>
        <h2 className="preview-title">{variant.name}</h2>
        <p className="preview-subtitle">
          {t('preview.subtitle', { from: formatMeters(fromM), to: formatMeters(toM) })}
        </p>
      </div>

      <div className="preview-sheet">
        <div className="preview-info">
          <div className="chips">
            <span className="chip">
              {t('chip.distance')}{' '}
              <strong data-testid="stat-distance">{formatKm(stats.distanceM)}</strong>{' '}
              {t('unit.km')}
            </span>
            <span className="chip">
              {t('chip.ascent')}{' '}
              <strong data-testid="stat-ascent">{formatMeters(stats.ascentM)}</strong> {t('unit.m')}
            </span>
            <span className="chip">
              {t('chip.descent')}{' '}
              <strong data-testid="stat-descent">{formatMeters(stats.descentM)}</strong>{' '}
              {t('unit.m')}
            </span>
            <span className="chip">
              {t('chip.maxGrade')}{' '}
              <strong data-testid="stat-max-grade">{formatGradePct(stats.maxGrade)}</strong>
              {t('unit.percent')}
            </span>
          </div>

          {markers && <ProgressMarkerRow markers={markers} distanceM={0} preview />}

          <div className="profile-card">
            <ElevationProfile
              profile={profile}
              startDistanceM={startM}
              onSelectDistance={(d) => setStartM(Math.round(d / 100) * 100)}
            />
            <StartPointPicker course={course} value={startM} onChange={setStartM} />
          </div>
          <p className="hint">
            {t(`preview.elevationSource.${variant.elevationSource}`)} {t('start.hint')}
          </p>
          {!variant.hasElevation && (
            <p className="notice notice-warn">{t('preview.noElevation')}</p>
          )}
          {variant.steepSections.length > 0 && (
            <p className="notice notice-warn">
              {t('preview.steepSections', { count: variant.steepSections.length })}
            </p>
          )}

          <div className="preview-options">
            <label className="option-toggle">
              <input
                type="checkbox"
                checked={reversed}
                onChange={(e) => changeDirection(e.target.checked)}
              />
              {t('preview.reverse')}
            </label>
            <GhostPicker route={variant} value={effectiveGhost} onChange={setGhostRef} />
          </div>
        </div>

        <div className="preview-go">
          <div className="preview-map">
            <RouteMap profile={profile} position={startPosition} relief className="map map-fill" />
            <StreetImageCoverage route={variant} />
          </div>
          {trainerState === 'connected' ? (
            <button
              type="button"
              className="button-primary button-go"
              disabled={starting}
              onClick={() => void start()}
            >
              {t('preview.start')}
            </button>
          ) : (
            <div className="go-connect">
              <p className="hint">{t('preview.connectHint')}</p>
              <button
                type="button"
                className="button-primary button-go"
                disabled={!devices.trainer || trainerState !== 'disconnected'}
                onClick={() => void deviceActions.connectTrainer()}
              >
                {t('trainer.connect')}
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
