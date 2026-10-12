import type { ParsedRoute } from '../types.ts'
import { RouteParseError } from './RouteParseError.ts'
import { parseIsoTimeMs, toElapsed } from './time.ts'
import { child, children, num, parseXml, text } from './xml.ts'

/** TCX。Courses/Course（コース）を優先し、なければ Activities/Activity（実走）を読む。 */
export function parseTcx(xml: string): ParsedRoute {
  const doc = parseXml(xml)
  const root = child(doc, 'TrainingCenterDatabase')
  if (!root) throw new RouteParseError('invalidFile', 'TrainingCenterDatabase 要素がありません')

  const courses = children(child(root, 'Courses'), 'Course')
  const activities = children(child(root, 'Activities'), 'Activity')
  const isCourse = courses.length > 0
  const tracks = isCourse
    ? courses.flatMap((c) => children(c, 'Track'))
    : activities.flatMap((a) => children(a, 'Lap').flatMap((lap) => children(lap, 'Track')))

  const withTime = tracks
    .flatMap((track) => children(track, 'Trackpoint'))
    .flatMap((tp) => {
      const pos = child(tp, 'Position')
      const lat = num(text(pos, 'LatitudeDegrees'))
      const lon = num(text(pos, 'LongitudeDegrees'))
      if (lat === undefined || lon === undefined) return []
      return [
        {
          lat,
          lon,
          elevationM: num(text(tp, 'AltitudeMeters')),
          timeMs: parseIsoTimeMs(text(tp, 'Time')),
        },
      ]
    })
  if (withTime.length < 2) throw new RouteParseError('noPoints', 'TCX に位置情報がありません')

  // コースの Time は計画上の時刻なので、実走の時刻として扱わない
  if (isCourse) {
    return {
      format: 'tcx',
      name: text(courses[0], 'Name'),
      points: withTime.map(({ timeMs: _t, ...p }) => p),
      elevationSource: 'dem',
    }
  }
  const { points, startedAtMs } = toElapsed(withTime)
  return { format: 'tcx', name: undefined, points, elevationSource: 'barometric', startedAtMs }
}
