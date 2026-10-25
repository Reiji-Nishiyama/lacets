import { describe, expect, it } from 'vitest'
import { projectOntoRoute } from '../ghost/project.ts'
import { buildRouteGrid } from './routeGrid.ts'
import type { ProfilePoint } from './types.ts'

/** つづら折り（東西に 300 m 往復しながら北へ登る）を 10 m ごとの点で */
function switchbacks(): ProfilePoint[] {
  const points: ProfilePoint[] = []
  const mPerDegLat = 111_195
  const lat0 = 45.05
  const mPerDegLon = mPerDegLat * Math.cos((lat0 * Math.PI) / 180)
  let d = 0
  let x = 0
  let y = 0
  for (let leg = 0; leg < 12; leg++) {
    const dir = leg % 2 === 0 ? 1 : -1
    for (let s = 0; s < 30; s++) {
      points.push({
        distanceM: d,
        lat: lat0 + y / mPerDegLat,
        lon: 6.03 + x / mPerDegLon,
        elevationM: 0,
        grade: 0,
      })
      x += 10 * dir
      d += 10
    }
    for (let s = 0; s < 4; s++) {
      points.push({
        distanceM: d,
        lat: lat0 + y / mPerDegLat,
        lon: 6.03 + x / mPerDegLon,
        elevationM: 0,
        grade: 0,
      })
      y += 10
      d += 10
    }
  }
  return points
}

describe('buildRouteGrid', () => {
  it('全区間をなめる探索と同じ位置を返す', () => {
    const profile = switchbacks()
    const grid = buildRouteGrid(profile)
    // ルートの周りに格子状に点を置いて比べる
    for (let i = 0; i < 400; i++) {
      const lat = 45.05 + ((i * 37) % 500) / 111_195 - 0.0001
      const lon = 6.03 + ((i * 53) % 380) / 78_600 - 0.0002
      const brute = projectOntoRoute(profile, [{ lat, lon, timeS: 0 }], {
        maxOffsetM: 20,
        initialWindowM: Infinity,
      }).points[0]
      const hit = grid.nearest(lat, lon, 20)
      if (!brute) {
        // 境界ぎりぎりは投影の緯度の違いで 1 cm 単位ずれうる
        if (hit) expect(hit.offsetM).toBeGreaterThan(19.9)
        continue
      }
      expect(hit).not.toBeNull()
      expect(hit!.offsetM).toBeCloseTo(brute.offsetM, 1)
      expect(hit!.distanceM).toBeCloseTo(brute.distanceM, 0)
    }
  })

  it('離れた点は null', () => {
    const grid = buildRouteGrid(switchbacks())
    expect(grid.nearest(45.2, 6.5, 20)).toBeNull()
  })
})
