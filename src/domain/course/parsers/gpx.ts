import type { ParsedRoute } from '../types.ts'
import { RouteParseError } from './RouteParseError.ts'
import { parseIsoTimeMs, toElapsed } from './time.ts'
import { child, children, num, parseXml, text, type XmlNode } from './xml.ts'

/**
 * GPX 1.1 / 1.0。trk（複数セグメントは連結）を優先し、なければ rte を読む。
 * Strava のルート、Garmin Connect のコース、各種サービスの GPX を想定。
 */
export function parseGpx(xml: string): ParsedRoute {
  const doc = parseXml(xml)
  const gpx = child(doc, 'gpx')
  if (!gpx) throw new RouteParseError('invalidFile', 'gpx 要素がありません')

  const tracks = children(gpx, 'trk')
  const routes = children(gpx, 'rte')
  let rawPoints: XmlNode[] = tracks.flatMap((trk) =>
    children(trk, 'trkseg').flatMap((seg) => children(seg, 'trkpt')),
  )
  if (rawPoints.length === 0) rawPoints = routes.flatMap((rte) => children(rte, 'rtept'))

  const withTime = rawPoints.flatMap((pt) => {
    const lat = num(pt['@_lat'])
    const lon = num(pt['@_lon'])
    if (lat === undefined || lon === undefined) return []
    return [
      { lat, lon, elevationM: num(text(pt, 'ele')), timeMs: parseIsoTimeMs(text(pt, 'time')) },
    ]
  })
  if (withTime.length < 2) throw new RouteParseError('noPoints', 'GPX に位置情報がありません')

  const { points, startedAtMs } = toElapsed(withTime)
  const name =
    text(child(gpx, 'metadata'), 'name') ?? text(tracks[0], 'name') ?? text(routes[0], 'name')
  // 時刻付きの軌跡は実走の記録とみなす（GPX の標高が気圧高度とは限らないが、DEM より滑らか）
  const recorded = startedAtMs !== undefined && points.every((p) => p.timeS !== undefined)
  return {
    format: 'gpx',
    name,
    points,
    elevationSource: recorded ? 'barometric' : 'dem',
    startedAtMs,
  }
}
