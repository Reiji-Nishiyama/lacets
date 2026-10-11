import { Decoder, Stream } from '@garmin/fitsdk'
import type { ParsedRoute } from '../types.ts'
import { RouteParseError } from './RouteParseError.ts'
import { toElapsed } from './time.ts'

const SEMICIRCLE_TO_DEG = 180 / 2 ** 31
/** FIT の File 型: course = 6, activity = 4 */
const FILE_COURSE = 6

/**
 * FIT のコース（Garmin Connect 等）と実走（Wahoo ELEMNT / Garmin Edge）。record メッセージの位置と標高を読む。
 */
export function parseFit(bytes: Uint8Array): ParsedRoute {
  const stream = Stream.fromByteArray(bytes)
  if (!Decoder.isFIT(stream)) throw new RouteParseError('invalidFile', 'FIT ファイルではありません')
  const decoder = new Decoder(stream)
  const { messages, errors } = decoder.read({ mergeHeartRates: false })
  if (errors.length > 0 && !messages.recordMesgs?.length) {
    throw new RouteParseError('invalidFile', `FIT を読めませんでした: ${errors[0]?.message ?? ''}`)
  }

  const fileType = messages.fileIdMesgs?.[0]?.type as string | number | undefined
  const isCourse = fileType === 'course' || fileType === FILE_COURSE

  const withTime = (messages.recordMesgs ?? []).flatMap((r) => {
    if (r.positionLat === undefined || r.positionLong === undefined) return []
    const altitude = r.enhancedAltitude ?? r.altitude
    const ts = r.timestamp
    return [
      {
        lat: r.positionLat * SEMICIRCLE_TO_DEG,
        lon: r.positionLong * SEMICIRCLE_TO_DEG,
        elevationM: typeof altitude === 'number' ? altitude : undefined,
        timeMs: isCourse ? undefined : ts instanceof Date ? ts.getTime() : undefined,
      },
    ]
  })
  if (withTime.length < 2) throw new RouteParseError('noPoints', 'FIT に位置情報がありません')

  const { points, startedAtMs } = toElapsed(withTime)
  const name = messages.courseMesgs?.[0]?.name
  return {
    format: 'fit',
    name: typeof name === 'string' && name ? name : undefined,
    points,
    elevationSource: isCourse ? 'dem' : 'barometric',
    startedAtMs,
  }
}
