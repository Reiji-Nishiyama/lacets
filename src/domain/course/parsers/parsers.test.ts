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
