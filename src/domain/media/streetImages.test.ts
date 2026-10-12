import { describe, expect, it } from 'vitest'
import { northboundRoute, M_PER_DEG_LAT } from '../../../test/helpers/syntheticRoute.ts'
import { Course } from '../course/Course.ts'
import { buildProfile } from '../course/profile.ts'
import {
  angleDiffDeg,
  imageAt,
  imageCoverage,
  imagesBetween,
  indexImagesAlongRoute,
  panoCenterFraction,
  searchCellsAlongRoute,
  type StreetImage,
} from './streetImages.ts'

// (45°N, 6°E) から真北へ 1 km
const { profile } = buildProfile(
  northboundRoute(1000, 10, () => 0),
  'dem',
)
const course = new Course(profile)
const headingAt = (d: number) => course.positionAt(d).headingDeg
const M_PER_DEG_LON = M_PER_DEG_LAT * Math.cos((45 * Math.PI) / 180)

let n = 0
function image(
  distanceM: number,
  opts: Partial<StreetImage> & { eastM?: number } = {},
): StreetImage {
  const { eastM = 0, ...rest } = opts
  n++
  return {
    provider: 'panoramax',
    id: `img-${n}`,
    lat: 45 + distanceM / M_PER_DEG_LAT,
    lon: 6 + eastM / M_PER_DEG_LON,
    azimuthDeg: 0,
    isPano: false,
    capturedAtMs: Date.parse('2025-01-01'),
    imageUrl: `https://example.com/${n}.jpg`,
    thumbUrl: `https://example.com/${n}-t.jpg`,
    creator: 'tester',
    license: 'CC-BY-SA-4.0',
    ...rest,
  }
}

describe('indexImagesAlongRoute', () => {
  it('ルート上の距離で並べ、離れた画像・逆向きの平面画像を除く', () => {
    const images = [
      image(300),
      image(100, { eastM: 8 }),
      image(200, { eastM: 50 }), // 遠い
      image(400, { azimuthDeg: 180 }), // 逆向き
      image(500, { azimuthDeg: 180, isPano: true }), // パノラマは向きを問わない
      image(600, { azimuthDeg: null }), // 向き不明の平面画像
    ]
    const index = indexImagesAlongRoute(profile, images, headingAt)
    expect(index.map((r) => Math.round(r.distanceM))).toEqual([100, 300, 500])
    expect(index[0]!.offsetM).toBeCloseTo(8, 0)
  })
})

describe('imageAt / imagesBetween / imageCoverage', () => {
  const index = indexImagesAlongRoute(
    profile,
    [image(100), image(120), image(300), image(310, { capturedAtMs: Date.parse('2015-01-01') })],
    headingAt,
  )

  it('現在地に最も近い画像（少し後ろ〜少し先）', () => {
    expect(imageAt(index, 105)?.distanceM).toBeCloseTo(100, 0)
    expect(imageAt(index, 115)?.distanceM).toBeCloseTo(120, 0)
    expect(imageAt(index, 140)?.distanceM).toBeCloseTo(120, 0) // 20 m 後ろ
    expect(imageAt(index, 160)).toBeNull()
    expect(imageAt(index, 290)?.distanceM).toBeCloseTo(300, 0) // 10 m 先
  })

  it('同じくらい近ければ新しい撮影を優先する', () => {
    const nowMs = Date.parse('2026-01-01')
    expect(imageAt(index, 306, { nowMs })?.distanceM).toBeCloseTo(300, 0)
  })

  it('先読みの範囲と、表示できる割合', () => {
    expect(imagesBetween(index, 110, 305).map((r) => Math.round(r.distanceM))).toEqual([120, 300])
    const coverage = imageCoverage(index, 1000)
    expect(coverage).toBeGreaterThan(0.08)
    expect(coverage).toBeLessThan(0.15)
    expect(imageCoverage([], 1000)).toBe(0)
  })
})

describe('角度・パノラマ・検索範囲', () => {
  it('angleDiffDeg', () => {
    expect(angleDiffDeg(350, 10)).toBe(20)
    expect(angleDiffDeg(0, 180)).toBe(180)
    expect(angleDiffDeg(90, 45)).toBe(45)
  })

  it('panoCenterFraction: 見たい方向を中央に置く横位置', () => {
    expect(panoCenterFraction(0, 0)).toBe(0.5)
    expect(panoCenterFraction(0, 90)).toBe(0.75)
    expect(panoCenterFraction(90, 0)).toBe(0.25)
    expect(panoCenterFraction(0, 270)).toBe(0.25)
  })

  it('searchCellsAlongRoute: ルートが通るマス目だけ（重複なし、0.01 度四方未満）', () => {
    const cells = searchCellsAlongRoute(profile)
    // 1 km 北上 = 緯度 0.009 度 → 0.005 度のマスで 2〜3 個
    expect(cells.length).toBeGreaterThanOrEqual(2)
    expect(cells.length).toBeLessThanOrEqual(3)
    for (const [w, s, e, nn] of cells) expect((e - w) * (nn - s)).toBeLessThan(0.0001)
  })
})
