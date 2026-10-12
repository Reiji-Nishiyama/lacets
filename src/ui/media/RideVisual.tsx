import { useEffect, useMemo, useState } from 'react'
import type { Course } from '../../domain/course/Course.ts'
import { imageAt, imagesBetween } from '../../domain/media/streetImages.ts'
import type { RouteVariant } from '../../store/routeVariant.ts'
import { useSettingsStore } from '../../store/settingsStore.ts'
import {
  ensureStreetImages,
  streetImageKey,
  useStreetImageStore,
} from '../../store/streetImageStore.ts'
import { RouteMap, type MapPosition } from '../common/RouteMap.tsx'
import { MAP_STYLE_URL, satelliteStyleUrl } from '../common/mapConfig.ts'
import { t } from '../i18n/index.ts'
import { StreetImageView } from './StreetImageView.tsx'

type VisualMode = 'auto' | 'image' | 'terrain' | 'map'
const MODES: VisualMode[] = ['auto', 'image', 'terrain', 'map']

/** 先読みする範囲 [m] */
const PRELOAD_AHEAD_M = 200
/** カメラ・パノラマを向ける方位は、この距離先までの区間で滑らかにする [m] */
const HEADING_LOOKAHEAD_M = 50

/**
 * 走行中のビジュアル（docs/02 §9）。自動では、路上画像がある地点は画像、ない地点は 3D 地形ビュー。
 * 3D 地形ビューは切り替えのたびに作り直さないよう、画像の下に常に置いておく。
 */
export function RideVisual({
  route,
  course,
  distanceM,
  position,
  ghostPosition,
}: {
  route: RouteVariant
  course: Course
  distanceM: number
  position: MapPosition
  ghostPosition?: MapPosition
}) {
  const [mode, setMode] = useState<VisualMode>('auto')
  const media = useSettingsStore((s) => s.media)
  const key = streetImageKey(route.variantKey, media)
  const images = useStreetImageStore((s) => s.byKey[key])

  useEffect(() => {
    ensureStreetImages(route, media)
  }, [route, media])

  const index = useMemo(() => images?.index ?? [], [images])
  const [nowMs] = useState(() => Date.now())
  const current = imageAt(index, distanceM, { nowMs })
  // 先読みは 50 m 進むごとに更新する（毎ティック配列を作り直さない）
  const preloadFrom = Math.floor(distanceM / 50) * 50
  const preload = useMemo(
    () => imagesBetween(index, preloadFrom, preloadFrom + PRELOAD_AHEAD_M).map((r) => r.image),
    [index, preloadFrom],
  )
  const headingDeg = course.headingBetween(distanceM, distanceM + HEADING_LOOKAHEAD_M)
  // MapTiler に拒否されたら（キーの誤り・無料枠の上限）、このセッションでは通常の地図に戻す
  const [maptilerFailed, setMaptilerFailed] = useState(false)
  const useSatellite = media.maptilerKey.trim() !== '' && !maptilerFailed
  const terrainStyle = useSatellite ? satelliteStyleUrl(media.maptilerKey.trim()) : MAP_STYLE_URL

  const showImage = (mode === 'auto' || mode === 'image') && current !== null

  return (
    <div className="ride-visual">
      <div className="ride-visual-stage">
        {mode === 'map' ? (
          <RouteMap
            profile={route.profile}
            position={position}
            ghostPosition={ghostPosition}
            follow
            className="map map-fill"
          />
        ) : (
          <RouteMap
            profile={route.profile}
            position={position}
            ghostPosition={ghostPosition}
            follow
            terrain
            bearingDeg={headingDeg}
            styleUrl={terrainStyle}
            className="map map-fill"
            onMaptilerError={() => setMaptilerFailed(true)}
          />
        )}
        {showImage && current && (
          <div className="ride-visual-overlay">
            <StreetImageView image={current.image} headingDeg={headingDeg} preload={preload} />
          </div>
        )}
        {maptilerFailed && (
          <div className="ride-visual-notice" role="status">
            {t('visual.maptilerFallback')}
          </div>
        )}
        {mode === 'image' && !current && (
          <div className="ride-visual-message">{t('visual.noImageHere')}</div>
        )}
      </div>
      <div className="tabs visual-tabs" role="tablist">
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            className={`tab${mode === m ? ' tab-active' : ''}`}
            onClick={() => setMode(m)}
          >
            {t(`visual.mode.${m}`)}
          </button>
        ))}
      </div>
    </div>
  )
}
