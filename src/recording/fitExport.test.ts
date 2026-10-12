import { Decoder, Stream } from '@garmin/fitsdk'
import { describe, expect, it } from 'vitest'
import { sampleRide, T0 } from '../../test/helpers/recordedRide.ts'
import { encodeRideFit, rideFitFileName } from './fitExport.ts'

function decode(bytes: Uint8Array) {
  const decoder = new Decoder(Stream.fromByteArray(bytes))
  expect(decoder.checkIntegrity()).toBe(true)
  const { messages, errors } = new Decoder(Stream.fromByteArray(bytes)).read()
  expect(errors).toEqual([])
  return messages
}

describe('encodeRideFit', () => {
  const ride = sampleRide()
  const m = decode(encodeRideFit(ride, 540))

  it('file_id は activity', () => {
    expect(m.fileIdMesgs?.[0]?.type).toBe('activity')
    expect(m.fileIdMesgs?.[0]?.manufacturer).toBe('development')
  })

  it('record に仮想ルートの位置・標高・パワー等を 1 Hz で書く', () => {
    const records = m.recordMesgs ?? []
    expect(records).toHaveLength(90)
    const r = records[9]!
    expect(r.timestamp).toEqual(new Date(T0 + 10_000))
    expect((r.positionLat ?? 0) * (180 / 2 ** 31)).toBeCloseTo(45.0004, 5)
    expect((r.positionLong ?? 0) * (180 / 2 ** 31)).toBeCloseTo(6, 5)
    expect(r.enhancedAltitude).toBeCloseTo(704, 0)
    expect(r.distance).toBeCloseTo(50, 1)
    expect(r.enhancedSpeed).toBeCloseTo(5, 2)
    expect(r.power).toBe(200)
    expect(r.cadence).toBe(0)
    expect(r.heartRate).toBe(140)
    expect(r.grade).toBeCloseTo(8)
    // 欠測の心拍は書かない
    expect(records[0]?.heartRate).toBeUndefined()
  })

  it('一時停止を timer の stop_all / start イベントで表す', () => {
    const timer = (m.eventMesgs ?? []).filter((e) => e.event === 'timer')
    expect(timer.map((e) => [e.eventType, (e.timestamp as Date).getTime() - T0])).toEqual([
      ['start', 0],
      ['stopAll', 60_000],
      ['start', 90_000],
      ['stopAll', 120_000],
    ])
  })

  it('session は cycling / virtual_activity で集計値を持つ', () => {
    const s = m.sessionMesgs?.[0]
    expect(s?.sport).toBe('cycling')
    expect(s?.subSport).toBe('virtualActivity')
    expect(s?.totalTimerTime).toBe(90)
    expect(s?.totalElapsedTime).toBe(120)
    expect(s?.totalDistance).toBeCloseTo(450)
    expect(s?.avgPower).toBe(210)
    expect(s?.maxPower).toBe(220)
    expect(s?.numLaps).toBe(1)
    expect(m.lapMesgs).toHaveLength(1)
  })

  it('activity は 1 セッションでローカル時刻を持つ', () => {
    const a = m.activityMesgs?.[0]
    expect(a?.numSessions).toBe(1)
    expect(a?.totalTimerTime).toBe(90)
    // 終了 09:32Z + 9 時間 = 現地 18:32
    const fitEpochS = Date.UTC(1989, 11, 31) / 1000
    expect(a?.localTimestamp).toBe((T0 + 120_000) / 1000 - fitEpochS + 9 * 3600)
  })
})

describe('途中から走った記録', () => {
  it('FIT の distance は走った距離（0 から）', () => {
    const base = sampleRide()
    const ride = {
      ...base,
      startDistanceM: 5000,
      samples: base.samples.map((x) => ({ ...x, distanceM: 5000 + x.distanceM })),
    }
    const m = decode(encodeRideFit(ride))
    expect(m.recordMesgs?.[9]?.distance).toBeCloseTo(50, 1)
  })
})

describe('rideFitFileName', () => {
  it('日時とルート名からファイル名を作り、使えない文字を置き換える', () => {
    const ride = { ...sampleRide(), routeName: "Alpe d'Huez / 21 lacets" }
    expect(rideFitFileName(ride)).toMatch(/^lacets-\d{8}-\d{4}-Alpe_d'Huez_21_lacets\.fit$/)
  })
})
