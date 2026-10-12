import {
  Encoder,
  type ActivityMesg,
  type Encodable,
  type EventMesg,
  type FileIdMesg,
  type LapMesg,
  type RecordMesg,
  type SessionMesg,
} from '@garmin/fitsdk'
import type { RecordedRide, RideStats } from './types.ts'

/** FIT プロファイルの値（Profile.types で確認済み） */
const MESG_NUM = { FILE_ID: 0, SESSION: 18, LAP: 19, RECORD: 20, EVENT: 21, ACTIVITY: 34 } as const
const FILE_ACTIVITY = 4
const MANUFACTURER_DEVELOPMENT = 255
const SPORT_CYCLING = 2
const SUB_SPORT_VIRTUAL_ACTIVITY = 58
const EVENT = { TIMER: 0, SESSION: 8, LAP: 9, ACTIVITY: 26 } as const
const EVENT_TYPE = { START: 0, STOP: 1, STOP_ALL: 4 } as const
const ACTIVITY_MANUAL = 0
const SESSION_TRIGGER_ACTIVITY_END = 0
const LAP_TRIGGER_SESSION_END = 7

/** FIT の時刻の基準（1989-12-31T00:00:00Z） */
const FIT_EPOCH_MS = Date.UTC(1989, 11, 31)

const DEG_TO_SEMICIRCLE = 2 ** 31 / 180
const toSemicircles = (deg: number) => Math.round(deg * DEG_TO_SEMICIRCLE)

/** 製品番号（任意の値）。Lacets で作った FIT であることを示す */
const PRODUCT_ID = 1

/**
 * 走行記録を FIT（Activity, sport = cycling, sub_sport = virtual_activity）にエンコードする（F4-2）。
 * 仮想ルート上の緯度経度・標高・パワー・ケイデンス・心拍・速度を record に書き、
 * 一時停止は timer イベント、集計は lap / session / activity に書く。
 */
export function encodeRideFit(
  ride: RecordedRide,
  /** UTC からの時差 [分]（日本なら 540）。activity の local_timestamp に使う */
  tzOffsetMinutes = 0,
): Uint8Array {
  const encoder = new Encoder()
  const start = new Date(ride.startedAtMs)
  const end = new Date(ride.endedAtMs)

  const fileId: Encodable<FileIdMesg> = {
    mesgNum: MESG_NUM.FILE_ID,
    type: FILE_ACTIVITY,
    manufacturer: MANUFACTURER_DEVELOPMENT,
    product: PRODUCT_ID,
    serialNumber: hashSerial(ride.id),
    timeCreated: start,
  }
  encoder.writeMesg(fileId)

  // record と timer イベントを時刻順に並べる（同時刻ならイベントを先に）
  const items = [
    ...ride.events.map((e) => ({ t: e.timestampMs, order: 0, write: () => writeEvent(e) })),
    ...ride.samples.map((s) => ({ t: s.timestampMs, order: 1, write: () => writeRecord(s) })),
  ].sort((a, b) => a.t - b.t || a.order - b.order)

  function writeEvent(e: RecordedRide['events'][number]) {
    const msg: Encodable<EventMesg> = {
      mesgNum: MESG_NUM.EVENT,
      timestamp: new Date(e.timestampMs),
      event: EVENT.TIMER,
      eventType: e.type === 'start' ? EVENT_TYPE.START : EVENT_TYPE.STOP_ALL,
    }
    encoder.writeMesg(msg)
  }

  function writeRecord(s: RecordedRide['samples'][number]) {
    const msg: Encodable<RecordMesg> = {
      mesgNum: MESG_NUM.RECORD,
      timestamp: new Date(s.timestampMs),
      positionLat: toSemicircles(s.lat),
      positionLong: toSemicircles(s.lon),
      altitude: s.elevationM,
      enhancedAltitude: s.elevationM,
      distance: s.distanceM,
      speed: s.speedMps,
      enhancedSpeed: s.speedMps,
      power: Math.max(0, Math.round(s.powerW)),
      grade: s.grade * 100,
      ...(s.cadenceRpm == null ? {} : { cadence: Math.round(s.cadenceRpm) }),
      ...(s.heartRateBpm == null ? {} : { heartRate: Math.round(s.heartRateBpm) }),
    }
    encoder.writeMesg(msg)
  }

  for (const item of items) item.write()

  const summary = summaryFields(ride.stats)
  const lap: Encodable<LapMesg> = {
    mesgNum: MESG_NUM.LAP,
    messageIndex: 0,
    timestamp: end,
    startTime: start,
    event: EVENT.LAP,
    eventType: EVENT_TYPE.STOP,
    lapTrigger: LAP_TRIGGER_SESSION_END,
    sport: SPORT_CYCLING,
    subSport: SUB_SPORT_VIRTUAL_ACTIVITY,
    ...summary,
  }
  encoder.writeMesg(lap)

  const session: Encodable<SessionMesg> = {
    mesgNum: MESG_NUM.SESSION,
    messageIndex: 0,
    timestamp: end,
    startTime: start,
    event: EVENT.SESSION,
    eventType: EVENT_TYPE.STOP,
    trigger: SESSION_TRIGGER_ACTIVITY_END,
    sport: SPORT_CYCLING,
    subSport: SUB_SPORT_VIRTUAL_ACTIVITY,
    firstLapIndex: 0,
    numLaps: 1,
    ...summary,
  }
  encoder.writeMesg(session)

  const activity: Encodable<ActivityMesg> = {
    mesgNum: MESG_NUM.ACTIVITY,
    timestamp: end,
    totalTimerTime: ride.stats.movingTimeS,
    numSessions: 1,
    type: ACTIVITY_MANUAL,
    event: EVENT.ACTIVITY,
    eventType: EVENT_TYPE.STOP,
    // local_date_time は Date を受け付けないため、FIT エポックからの秒数（現地時刻）で渡す
    localTimestamp: Math.round((ride.endedAtMs - FIT_EPOCH_MS) / 1000) + tzOffsetMinutes * 60,
  }
  encoder.writeMesg(activity)

  return encoder.close()
}

function summaryFields(s: RideStats) {
  return {
    totalElapsedTime: s.elapsedWallS,
    totalTimerTime: s.movingTimeS,
    totalDistance: s.distanceM,
    totalAscent: Math.round(s.ascentM),
    avgSpeed: s.averageSpeedMps,
    maxSpeed: s.maxSpeedMps,
    enhancedAvgSpeed: s.averageSpeedMps,
    enhancedMaxSpeed: s.maxSpeedMps,
    avgPower: Math.round(s.averagePowerW),
    maxPower: Math.round(s.maxPowerW),
    ...(s.averageCadenceRpm == null ? {} : { avgCadence: Math.round(s.averageCadenceRpm) }),
    ...(s.averageHeartRateBpm == null ? {} : { avgHeartRate: Math.round(s.averageHeartRateBpm) }),
    ...(s.maxHeartRateBpm == null ? {} : { maxHeartRate: Math.round(s.maxHeartRateBpm) }),
  }
}

/** 走行 ID から決まる 32bit のシリアル番号（0 は無効値なので避ける） */
function hashSerial(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0 || 1
}

/** ファイル名に使える形にする: lacets-20261012-0930-ルート名.fit */
export function rideFitFileName(ride: RecordedRide): string {
  const d = new Date(ride.startedAtMs)
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
  const name = ride.routeName.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40)
  return `lacets-${stamp}-${name}.fit`
}
