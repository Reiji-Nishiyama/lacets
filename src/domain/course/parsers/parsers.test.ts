import { describe, expect, it } from 'vitest'
import { buildFit } from '../../../../test/helpers/fitBuilder.ts'
import { readFixture } from '../../../../test/helpers/fixtures.ts'
import { parseRouteFile, RouteParseError } from './index.ts'

const enc = (s: string) => new TextEncoder().encode(s)

describe('GPX', () => {
  it('trk の複数セグメントを連結し、metadata の名前を使う', () => {
    const r = parseRouteFile(readFixture('track-two-segments.gpx'))
    expect(r.format).toBe('gpx')
    expect(r.name).toBe('テスト峠')
    expect(r.elevationSource).toBe('dem')
    expect(r.points).toEqual([
      { lat: 45, lon: 6, elevationM: 700 },
      { lat: 45.001, lon: 6, elevationM: 708 },
      { lat: 45.002, lon: 6, elevationM: 716 },
      { lat: 45.003, lon: 6, elevationM: undefined },
    ])
  })

  it('trk がなければ rte/rtept を読む', () => {
    const r = parseRouteFile(readFixture('route-rtept.gpx'))
    expect(r.name).toBe('Route only')
    expect(r.points).toHaveLength(2)
    expect(r.points[1]).toEqual({ lat: 35.001, lon: 138.001, elevationM: 1010 })
  })

  it('拡張タグの心拍・パワーを読む', () => {
    const r = parseRouteFile(
      enc(`<gpx xmlns:gpxtpx="x"><trk><trkseg>
        <trkpt lat="1" lon="2"><time>2026-01-01T00:00:00Z</time><extensions><power>250</power>
          <gpxtpx:TrackPointExtension><gpxtpx:hr>150</gpxtpx:hr><gpxtpx:cad>90</gpxtpx:cad></gpxtpx:TrackPointExtension></extensions></trkpt>
        <trkpt lat="1.001" lon="2"><time>2026-01-01T00:00:01Z</time></trkpt>
      </trkseg></trk></gpx>`),
    )
    expect(r.points[0]).toMatchObject({ powerW: 250, heartRateBpm: 150, cadenceRpm: 90 })
  })

  it('時刻付きの記録は経過秒数にし、気圧高度扱いにする', () => {
    const r = parseRouteFile(readFixture('recorded-ride.gpx'))
    expect(r.elevationSource).toBe('barometric')
    expect(r.startedAtMs).toBe(Date.parse('2026-06-07T06:30:00Z'))
    expect(r.points.map((p) => p.timeS)).toEqual([0, 5, 10])
    expect(r.points[0]?.elevationM).toBeCloseTo(1100.2)
  })

  it('位置が 2 点未満ならエラー', () => {
    const xml = '<gpx><trk><trkseg><trkpt lat="1" lon="2"/></trkseg></trk></gpx>'
    expect(() => parseRouteFile(enc(xml))).toThrow(RouteParseError)
  })
})

describe('TCX', () => {
  it('コース: 位置のない点を飛ばし、時刻は使わない', () => {
    const r = parseRouteFile(readFixture('course.tcx'))
    expect(r.format).toBe('tcx')
    expect(r.name).toBe('TCX Course')
    expect(r.elevationSource).toBe('dem')
    expect(r.startedAtMs).toBeUndefined()
    expect(r.points).toEqual([
      { lat: 45, lon: 6, elevationM: 700 },
      { lat: 45.001, lon: 6, elevationM: 705.5 },
    ])
  })

  it('実走: 心拍・ケイデンス・パワー（TPX 拡張）を読む', () => {
    const r = parseRouteFile(
      enc(`<TrainingCenterDatabase><Activities><Activity><Lap><Track>
        <Trackpoint><Time>2026-01-01T00:00:00Z</Time>
          <Position><LatitudeDegrees>1</LatitudeDegrees><LongitudeDegrees>2</LongitudeDegrees></Position>
          <HeartRateBpm><Value>145</Value></HeartRateBpm><Cadence>85</Cadence>
          <Extensions><ns3:TPX xmlns:ns3="x"><ns3:Watts>230</ns3:Watts></ns3:TPX></Extensions></Trackpoint>
        <Trackpoint><Time>2026-01-01T00:00:01Z</Time>
          <Position><LatitudeDegrees>1.001</LatitudeDegrees><LongitudeDegrees>2</LongitudeDegrees></Position></Trackpoint>
      </Track></Lap></Activity></Activities></TrainingCenterDatabase>`),
    )
    expect(r.points[0]).toMatchObject({ powerW: 230, heartRateBpm: 145, cadenceRpm: 85 })
  })

  it('実走: ラップをまたいで連結し、経過秒数を付ける', () => {
    const r = parseRouteFile(readFixture('activity.tcx'))
    expect(r.elevationSource).toBe('barometric')
    expect(r.points.map((p) => p.timeS)).toEqual([0, 60])
  })
})

describe('FIT', () => {
  const t0 = new Date('2026-06-07T06:30:00Z')
  const points = [
    { lat: 35.36, lon: 138.73, elevationM: 1100, time: t0 },
    { lat: 35.3601, lon: 138.7301, elevationM: 1101.4, time: new Date(t0.getTime() + 1000) },
    { lat: 35.3602, lon: 138.7302, elevationM: 1102.8, time: new Date(t0.getTime() + 2000) },
  ]

  it('実走（activity）: 位置・気圧高度・経過秒数', () => {
    const r = parseRouteFile(buildFit({ type: 'activity', points, useEnhancedAltitude: true }))
    expect(r.format).toBe('fit')
    expect(r.elevationSource).toBe('barometric')
    expect(r.startedAtMs).toBe(t0.getTime())
    expect(r.points).toHaveLength(3)
    expect(r.points[1]?.lat).toBeCloseTo(35.3601, 6)
    expect(r.points[1]?.lon).toBeCloseTo(138.7301, 6)
    expect(r.points[1]?.elevationM).toBeCloseTo(1101.4, 1)
    expect(r.points.map((p) => p.timeS)).toEqual([0, 1, 2])
  })

  it('実走のパワー・心拍・ケイデンスと記録機器のメーカーを読む', () => {
    const withSensors = points.map((p, i) => ({
      ...p,
      powerW: 200 + i,
      heartRateBpm: 140,
      cadenceRpm: 88,
    }))
    const wahoo = parseRouteFile(
      buildFit({ type: 'activity', points: withSensors, manufacturer: 32 }),
    )
    expect(wahoo.device).toBe('wahoo')
    expect(wahoo.points[1]).toMatchObject({ powerW: 201, heartRateBpm: 140, cadenceRpm: 88 })
    const garmin = parseRouteFile(buildFit({ type: 'activity', points, manufacturer: 1 }))
    expect(garmin.device).toBe('garmin')
    expect(garmin.points[0]?.powerW).toBeUndefined()
  })

  it('コース（course）: 名前を読み、時刻は使わない', () => {
    const r = parseRouteFile(buildFit({ type: 'course', name: 'FIT Course', points }))
    expect(r.name).toBe('FIT Course')
    expect(r.elevationSource).toBe('dem')
    expect(r.points[2]?.elevationM).toBeCloseTo(1102.8, 1)
    expect(r.points[0]?.timeS).toBeUndefined()
  })
})

describe('形式判定', () => {
  it('未対応の形式はエラー', () => {
    try {
      parseRouteFile(enc('hello'))
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(RouteParseError)
      expect((e as RouteParseError).code).toBe('unsupportedFormat')
    }
  })
})
