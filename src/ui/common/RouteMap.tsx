import type { Map as MapLibreMap, Marker } from 'maplibre-gl'
import { useEffect, useRef, useState } from 'react'
import type { ProfilePoint } from '../../domain/course/types.ts'
import { t } from '../i18n/index.ts'
import { MAP_STYLE_URL } from './mapConfig.ts'

/** 走行中に現在地を追うときのズーム */
const FOLLOW_ZOOM = 15

/** 地図に描く線の点数の上限 */
const MAX_LINE_POINTS = 2000

export interface MapPosition {
  lat: number
  lon: number
}

/**
 * ルートの線と現在位置を表示する 2D 地図。MapLibre は重いので動的に読み込む。
 * WebGL が使えない環境では案内を表示する。
 */
export function RouteMap({
  profile,
  position,
  ghostPosition,
  follow = false,
}: {
  profile: readonly ProfilePoint[]
  position?: MapPosition
  /** ゴーストの位置（あれば灰色のマーカーで表示） */
  ghostPosition?: MapPosition
  follow?: boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markerRef = useRef<Marker | null>(null)
  const ghostMarkerRef = useRef<Marker | null>(null)
  const followStartedRef = useRef(false)
  const [unavailable, setUnavailable] = useState(false)

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
          style: MAP_STYLE_URL,
          bounds,
          fitBoundsOptions: { padding: 40 },
          attributionControl: { compact: true },
        })
        map = m
        m.on('load', () => {
          m.addSource('route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: coords },
            },
          })
          m.addLayer({
            id: 'route-line',
            type: 'line',
            source: 'route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#e8590c', 'line-width': 4 },
          })
        })
        m.on('error', (e) => console.warn('地図のエラー', e.error))
        markerRef.current = new maplibregl.Marker({ color: '#1c7ed6' })
        ghostMarkerRef.current = new maplibregl.Marker({ color: '#868e96', scale: 0.8 })
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
  }, [profile])

  useEffect(() => {
    const map = mapRef.current
    const marker = markerRef.current
    if (!map || !marker || !position) return
    marker.setLngLat([position.lon, position.lat])
    if (!marker.getElement().isConnected) marker.addTo(map)
    if (!follow) return
    const center: [number, number] = [position.lon, position.lat]
    // 最初の追従でルート全体の表示から現在地に寄る。以降はズームを変えずに中心だけ動かす
    if (!followStartedRef.current) {
      followStartedRef.current = true
      map.jumpTo({ center, zoom: FOLLOW_ZOOM })
    } else {
      map.easeTo({ center, duration: 250, easing: (x) => x })
    }
  }, [position, follow])

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

  if (unavailable) return <div className="map map-unavailable">{t('map.unavailable')}</div>
  return <div className="map" ref={containerRef} />
}

function lineCoordinates(profile: readonly ProfilePoint[]): [number, number][] {
  const step = Math.max(1, Math.ceil(profile.length / MAX_LINE_POINTS))
  const coords: [number, number][] = []
  for (let i = 0; i < profile.length; i += step) coords.push([profile[i]!.lon, profile[i]!.lat])
  const last = profile[profile.length - 1]
  if (last && (profile.length - 1) % step !== 0) coords.push([last.lon, last.lat])
  return coords
}
