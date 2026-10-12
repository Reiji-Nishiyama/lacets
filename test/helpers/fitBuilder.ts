import {
  Encoder,
  type CourseMesg,
  type Encodable,
  type FileIdMesg,
  type RecordMesg,
} from '@garmin/fitsdk'

const DEG_TO_SEMICIRCLE = 2 ** 31 / 180
const MESG_NUM = { FILE_ID: 0, RECORD: 20, COURSE: 31 } as const
const FILE_TYPE = { activity: 4, course: 6 } as const
const MANUFACTURER_DEVELOPMENT = 255
const SPORT_CYCLING = 2

export interface FitPointInput {
  lat: number
  lon: number
  elevationM?: number
  time: Date
  powerW?: number
  heartRateBpm?: number
  cadenceRpm?: number
}

/** テスト用の FIT（course または activity）を Garmin FIT SDK で組み立てる */
export function buildFit(opts: {
  type: 'course' | 'activity'
  name?: string
  points: FitPointInput[]
  useEnhancedAltitude?: boolean
  /** FIT の manufacturer（garmin = 1, wahoo_fitness = 32）。既定は development */
  manufacturer?: number
}): Uint8Array {
  const encoder = new Encoder()
  // writeMesg は Encodable<Mesg> を受けるため、型付きの変数を経由して渡す
  const fileId: Encodable<FileIdMesg> = {
    mesgNum: MESG_NUM.FILE_ID,
    type: FILE_TYPE[opts.type],
    manufacturer: opts.manufacturer ?? MANUFACTURER_DEVELOPMENT,
    product: 0,
    timeCreated: opts.points[0]?.time ?? new Date(0),
    serialNumber: 1234,
  }
  encoder.writeMesg(fileId)
  if (opts.name) {
    const course: Encodable<CourseMesg> = {
      mesgNum: MESG_NUM.COURSE,
      name: opts.name,
      sport: SPORT_CYCLING,
    }
    encoder.writeMesg(course)
  }
  for (const p of opts.points) {
    const altitude =
      p.elevationM === undefined
        ? {}
        : opts.useEnhancedAltitude
          ? { enhancedAltitude: p.elevationM }
          : { altitude: p.elevationM }
    const record: Encodable<RecordMesg> = {
      mesgNum: MESG_NUM.RECORD,
      timestamp: p.time,
      positionLat: Math.round(p.lat * DEG_TO_SEMICIRCLE),
      positionLong: Math.round(p.lon * DEG_TO_SEMICIRCLE),
      ...altitude,
      ...(p.powerW === undefined ? {} : { power: p.powerW }),
      ...(p.heartRateBpm === undefined ? {} : { heartRate: p.heartRateBpm }),
      ...(p.cadenceRpm === undefined ? {} : { cadence: p.cadenceRpm }),
    }
    encoder.writeMesg(record)
  }
  return encoder.close()
}
