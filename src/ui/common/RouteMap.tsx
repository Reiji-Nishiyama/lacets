import type { Map as MapLibreMap, Marker } from 'maplibre-gl'
import { useEffect, useRef, useState } from 'react'
import type { ProfilePoint } from '../../domain/course/types.ts'
import { t } from '../i18n/index.ts'
import { countMaptilerRequest, isMaptilerUrl } from '../../media/maptilerUsage.ts'
import { MAP_STYLE_URL, TERRAIN_ATTRIBUTION, TERRAIN_MAX_ZOOM, TERRAIN_TILES } from './mapConfig.ts'
import { RELIEF_COLORS } from './relief.ts'

/** 走行中に現在地を追うときのズーム（2D / 3D） */
const FOLLOW_ZOOM = 15
const TERRAIN_FOLLOW_ZOOM = 15.5
/** 3D 地形ビューのカメラの傾き [deg] と、地形の高さの強調 */
const TERRAIN_PITCH = 62
const TERRAIN_EXAGGERATION = 1.3

/** 地図に描く線の点数の上限 */
const MAX_LINE_POINTS = 2000

export interface MapPosition {
  lat: number
  lon: number
}

/**
 * ルートの線と現在位置を表示する地図。MapLibre は重いので動的に読み込む。
 * terrain なら 3D 地形ビュー（docs/02 §9、F6-5）: 標高タイルで地形を立体にし、
 * カメラは現在位置の後方上空から進行方向（bearingDeg）を向く。
 * WebGL が使えない環境では案内を表示する。
 */
export function RouteMap({
  profile,
  position,
  ghostPosition,
  follow = false,
  terrain = false,
  bearingDeg,
  styleUrl = MAP_STYLE_URL,
  className = 'map',
  relief = false,
  onMaptilerError,
}: {
  profile: readonly ProfilePoint[]
  position?: MapPosition
  /** ゴーストの位置（あれば灰色のマーカーで表示） */
  ghostPosition?: MapPosition
  follow?: boolean
  terrain?: boolean
  /** 3D 地形ビューでカメラを向ける方位 */
  bearingDeg?: number
  styleUrl?: string
  className?: string
  /** 標高の帯で塗り分ける（docs/07-design.md。勾配図と同じ色の段） */
  relief?: boolean
  /** MapTiler がキーの誤り・利用上限で拒否したとき（呼び出し側で通常の地図に戻す） */
  onMaptilerError?: (status: number) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markerRef = useRef<Marker | null>(null)
  const ghostMarkerRef = useRef<Marker | null>(null)
  const followStartedRef = useRef(false)
  const [unavailable, setUnavailable] = useState(false)
  const onMaptilerErrorRef = useRef(onMaptilerError)
  useEffect(() => {
    onMaptilerErrorRef.current = onMaptilerError
  }, [onMaptilerError])
  const usesMaptiler = isMaptilerUrl(styleUrl)

  useEffect(() => {
    let cancelled = false
    let map: MapLibreMap | null = null
    void (async () => {
      try {
        const [maplibregl, { default: workerUrl }] = await Promise.all([
          import('maplibre-gl'),
          // Worker は単一ファイルなので、アセットとして出力して URL を渡す
          import('maplibre-gl/dist/maplibre-gl-worker.mjs?url'),
          import('maplibre-gl/dist/maplibre-gl.css'),
        ])
        if (cancelled || !containerRef.current) return
        maplibregl.setWorkerUrl(workerUrl)
        const coords = lineCoordinates(profile)
        const bounds = new maplibregl.LngLatBounds()
        for (const c of coords) bounds.extend(c)
        const m = new maplibregl.Map({
          container: containerRef.current,
          style: styleUrl,
          bounds,
          // 上は路上画像のピル、下は出典の分だけ空けて、始点とゴールの印が隠れないようにする
          fitBoundsOptions: { padding: { top: 64, bottom: 56, left: 40, right: 40 } },
          attributionControl: { compact: true },
          maxPitch: 75,
          // MapTiler の無料プランの使用量の目安を数える（docs/04）
          transformRequest: (url) => {
            countMaptilerRequest(url)
            return { url }
          },
        })
        map = m
        m.on('load', () => {
          // 出典は最初から「i」ボタンに畳み、ルートに重ねない（押すと開く）
          m.getContainer()
            .querySelector('.maplibregl-ctrl-attrib')
            ?.classList.remove('maplibregl-compact-show')
          if (terrain) addTerrain(m)
          if (relief) addRelief(m, profile)
          addRoute(m, coords, terrain)
        })
        m.on('error', (e) => {
          console.warn('地図のエラー', e.error)
          const err = e.error as { status?: number; url?: string } | undefined
          if (err?.url && isMaptilerUrl(err.url) && [401, 403, 429].includes(err.status ?? 0)) {
            onMaptilerErrorRef.current?.(err.status ?? 0)
          }
        })
        markerRef.current = new maplibregl.Marker({ element: dot('map-dot map-dot-here') })
        ghostMarkerRef.current = new maplibregl.Marker({ element: dot('map-dot map-dot-ghost') })
        mapRef.current = m
      } catch (e) {
        console.warn('地図を初期化できませんでした', e)
        if (!cancelled) setUnavailable(true)
      }
    })()
    return () => {
      cancelled = true
      markerRef.current?.remove()
      markerRef.current = null
      ghostMarkerRef.current?.remove()
      ghostMarkerRef.current = null
      map?.remove()
      mapRef.current = null
      followStartedRef.current = false
    }
  }, [profile, terrain, styleUrl, relief])

  useEffect(() => {
    const map = mapRef.current
    const marker = markerRef.current
    if (!map || !marker || !position) return
    marker.setLngLat([position.lon, position.lat])
    if (!marker.getElement().isConnected) marker.addTo(map)
    if (!follow) return
    const center: [number, number] = [position.lon, position.lat]
    const camera = terrain
      ? { center, bearing: bearingDeg ?? map.getBearing(), pitch: TERRAIN_PITCH }
      : { center }
    // 最初の追従でルート全体の表示から現在地に寄る。以降はズームを変えずにカメラを動かす
    if (!followStartedRef.current) {
      followStartedRef.current = true
      map.jumpTo({ ...camera, zoom: terrain ? TERRAIN_FOLLOW_ZOOM : FOLLOW_ZOOM })
    } else {
      map.easeTo({ ...camera, duration: 250, easing: (x) => x })
    }
  }, [position, follow, terrain, bearingDeg])

  useEffect(() => {
    const map = mapRef.current
    const marker = ghostMarkerRef.current
    if (!map || !marker) return
    if (!ghostPosition) {
      marker.remove()
      return
    }
    marker.setLngLat([ghostPosition.lon, ghostPosition.lat])
    if (!marker.getElement().isConnected) marker.addTo(map)
  }, [ghostPosition])

  if (unavailable) {
    return <div className={`${className} map-unavailable`}>{t('map.unavailable')}</div>
  }
  return (
    <div className={className} data-testid={terrain ? 'terrain-view' : undefined}>
      <div className="map-canvas" ref={containerRef} />
      {usesMaptiler && <MaptilerLogo />}
    </div>
  )
}

/** MapTiler の無料プランでは、地図の左下に maptiler.com へのリンク付きロゴの表示が必要 */
function MaptilerLogo() {
  return (
    <a
      className="maptiler-logo"
      href="https://www.maptiler.com"
      target="_blank"
      rel="noopener"
      data-testid="maptiler-logo"
    >
      <img src="https://api.maptiler.com/resources/logo.svg" alt="MapTiler" />
    </a>
  )
}

/** 現在地・ゴーストの丸（HTML 要素のマーカー） */
function dot(className: string): HTMLElement {
  const el = document.createElement('div')
  el.className = className
  return el
}

const PINE = '#2c5f4f'
const SUN = '#f4b63c'

/** ルート: 白い縁取りの太い緑の線、スタートは白、ゴールは太陽の黄色の丸（docs/07-design.md） */
function addRoute(m: MapLibreMap, coords: [number, number][], terrain: boolean) {
  m.addSource('route', {
    type: 'geojson',
    data: {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: coords },
    },
  })
  m.addLayer({
    id: 'route-casing',
    type: 'line',
    source: 'route',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': '#ffffff', 'line-width': terrain ? 11 : 10 },
  })
  m.addLayer({
    id: 'route-line',
    type: 'line',
    source: 'route',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': PINE, 'line-width': terrain ? 6 : 5 },
  })
  const first = coords[0]
  const last = coords[coords.length - 1]
  if (!first || !last) return
  m.addSource('route-ends', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { end: 'start' },
          geometry: { type: 'Point', coordinates: first },
        },
        {
          type: 'Feature',
          properties: { end: 'goal' },
          geometry: { type: 'Point', coordinates: last },
        },
      ],
    },
  })
  m.addLayer({
    id: 'route-ends',
    type: 'circle',
    source: 'route-ends',
    paint: {
      'circle-radius': 8,
      'circle-color': ['match', ['get', 'end'], 'goal', SUN, '#ffffff'],
      'circle-stroke-color': PINE,
      'circle-stroke-width': 3,
    },
  })
}

/** 標高の帯で塗り分け、陰影を付ける。色はルートの最低点 → 最高点に合わせる（勾配図と同じ段） */
function addRelief(m: MapLibreMap, profile: readonly ProfilePoint[]) {
  let minM = Infinity
  let maxM = -Infinity
  for (const p of profile) {
    minM = Math.min(minM, p.elevationM)
    maxM = Math.max(maxM, p.elevationM)
  }
  if (!Number.isFinite(minM)) return
  const span = Math.max(50, maxM - minM)
  const stops = RELIEF_COLORS.flatMap((color, i) => [
    minM + (span * i) / (RELIEF_COLORS.length - 1),
    color,
  ])
  const dem = {
    type: 'raster-dem' as const,
    tiles: [TERRAIN_TILES],
    tileSize: 256,
    maxzoom: TERRAIN_MAX_ZOOM,
    encoding: 'terrarium' as const,
    attribution: TERRAIN_ATTRIBUTION,
  }
  m.addSource('relief-dem', dem)
  // 地名や道路の文字より下に敷く
  const beforeId = m.getStyle().layers?.find((l) => l.type === 'symbol')?.id
  m.addLayer(
    {
      id: 'relief',
      type: 'color-relief',
      source: 'relief-dem',
      paint: {
        'color-relief-opacity': 0.55,
        'color-relief-color': [
          'interpolate',
          ['linear'],
          ['elevation'],
          minM - span,
          RELIEF_COLORS[0]!,
          ...stops,
          maxM + span,
          RELIEF_COLORS[RELIEF_COLORS.length - 1]!,
        ],
      },
    },
    beforeId,
  )
  m.addLayer(
    {
      id: 'relief-hillshade',
      type: 'hillshade',
      source: 'relief-dem',
      paint: { 'hillshade-exaggeration': 0.25 },
    },
    beforeId,
  )
}

/** 標高タイルで地形を立体にし、陰影を付ける（陰影には別のソースを使うのが推奨） */
function addTerrain(m: MapLibreMap) {
  const dem = {
    type: 'raster-dem' as const,
    tiles: [TERRAIN_TILES],
    tileSize: 256,
    maxzoom: TERRAIN_MAX_ZOOM,
    encoding: 'terrarium' as const,
    attribution: TERRAIN_ATTRIBUTION,
  }
  m.addSource('terrain-dem', dem)
  // 出典は 1 か所に出せば足りるので、陰影用のソースには付けない
  const { attribution, ...hillshadeDem } = dem
  m.addSource('hillshade-dem', hillshadeDem)
  m.addLayer({
    id: 'hillshade',
    type: 'hillshade',
    source: 'hillshade-dem',
    paint: { 'hillshade-exaggeration': 0.4 },
  })
  m.setTerrain({ source: 'terrain-dem', exaggeration: TERRAIN_EXAGGERATION })
}

function lineCoordinates(profile: readonly ProfilePoint[]): [number, number][] {
  const step = Math.max(1, Math.ceil(profile.length / MAX_LINE_POINTS))
  const coords: [number, number][] = []
  for (let i = 0; i < profile.length; i += step) coords.push([profile[i]!.lon, profile[i]!.lat])
  const last = profile[profile.length - 1]
  if (last && (profile.length - 1) % step !== 0) coords.push([last.lon, last.lat])
  return coords
}
