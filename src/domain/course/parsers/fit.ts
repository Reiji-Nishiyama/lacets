import { Decoder, Stream } from '@garmin/fitsdk'
import type { ParsedRoute, RecordingDevice, SensorValues } from '../types.ts'
import { RouteParseError } from './RouteParseError.ts'
import { toElapsed } from './time.ts'

const SEMICIRCLE_TO_DEG = 180 / 2 ** 31
/** FIT の File 型: course = 6, activity = 4 */
const FILE_COURSE = 6
/** FIT の Manufacturer: garmin = 1, wahoo_fitness = 32 */
const MANUFACTURER_GARMIN = 1
const MANUFACTURER_WAHOO = 32

function deviceOf(manufacturer: unknown): RecordingDevice {
  if (manufacturer === 'garmin' || manufacturer === MANUFACTURER_GARMIN) return 'garmin'
  if (manufacturer === 'wahooFitness' || manufacturer === MANUFACTURER_WAHOO) return 'wahoo'
  return 'other'
}

function sensors(r: { power?: number; heartRate?: number; cadence?: number }): SensorValues {
  return {
    ...(typeof r.power === 'number' ? { powerW: r.power } : {}),
    ...(typeof r.heartRate === 'number' ? { heartRateBpm: r.heartRate } : {}),
    ...(typeof r.cadence === 'number' ? { cadenceRpm: r.cadence } : {}),
  }
}

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

  const fileId = messages.fileIdMesgs?.[0]
  const fileType = fileId?.type as string | number | undefined
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
        ...(isCourse ? {} : sensors(r)),
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
    ...(isCourse ? {} : { device: deviceOf(fileId?.manufacturer) }),
  }
}
