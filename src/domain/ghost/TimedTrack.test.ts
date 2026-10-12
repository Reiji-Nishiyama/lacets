import { describe, expect, it } from 'vitest'
import { TimedTrack } from './TimedTrack.ts'

describe('TimedTrack', () => {
  const track = TimedTrack.fromSamples([
    { distanceM: 0, timeS: 100, powerW: 200 },
    { distanceM: 100, timeS: 110, powerW: 200 },
    { distanceM: 200, timeS: 130, powerW: 300 },
    { distanceM: 300, timeS: 140, powerW: 300 },
  ])

  it('時刻は最初の点を 0 にし、距離で補間する', () => {
    expect(track.timeAt(0)).toBe(0)
    expect(track.timeAt(50)).toBe(5)
    expect(track.timeAt(150)).toBe(20)
    expect(track.timeAt(300)).toBe(40)
    expect(track.timeAt(301)).toBeNull()
    expect(track.timeAt(-1)).toBeNull()
  })

  it('時刻から距離を引く（範囲外はクランプ）', () => {
    expect(track.distanceAt(5)).toBe(50)
    expect(track.distanceAt(20)).toBe(150)
    expect(track.distanceAt(-3)).toBe(0)
    expect(track.distanceAt(999)).toBe(300)
  })

  it('停車（同じ距離が続く）は離れた時刻を採り、スタート前の待機を含めない', () => {
    const t = TimedTrack.fromSamples([
      { distanceM: 0, timeS: 0 },
      { distanceM: 2, timeS: 30 }, // スタート地点で 30 秒待機（GPS の揺れ）
      { distanceM: 1, timeS: 60 },
      { distanceM: 50, timeS: 70 }, // ここで 10 m を超える = 60 秒にスタート地点を離れた
      { distanceM: 50, timeS: 100 }, // 50 m 地点で 30 秒停車
      { distanceM: 100, timeS: 110 },
    ])
    expect(t.coveredFromM).toBe(2)
    expect(t.timeAt(2)).toBe(0)
    expect(t.timeAt(50)).toBe(40)
    expect(t.timeAt(100)).toBe(50)
  })

  it('逆走（距離が大きく戻る）は単調化し、時刻を更新しない', () => {
    const t = TimedTrack.fromSamples([
      { distanceM: 0, timeS: 0 },
      { distanceM: 100, timeS: 10 },
      { distanceM: 80, timeS: 15 },
      { distanceM: 200, timeS: 30 },
    ])
    // 20 m 戻った点は逆走として無視する（100 m 地点の時刻は 10 秒のまま）
    expect(t.timeAt(100)).toBe(10)
    expect(t.timeAt(200)).toBe(30)
  })

  it('時間加重の平均パワー', () => {
    // 0〜10 s: 200 W、10〜20 s: 200 W（10〜30 s の間隔は 10 s で打ち切り）、30〜40 s: 300 W
    expect(track.averagePowerBetween(0, 30)).toBeCloseTo(200)
    expect(track.averagePowerBetween(0, 40)).toBeCloseTo((200 * 20 + 300 * 10) / 30)
    expect(track.averagePowerBetween(30, 41)).toBeCloseTo(300)
    expect(
      TimedTrack.fromSamples([{ distanceM: 0, timeS: 0 }]).averagePowerBetween(0, 1),
    ).toBeNull()
  })
})
