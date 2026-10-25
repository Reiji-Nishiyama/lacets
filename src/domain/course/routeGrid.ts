import type { ProfilePoint } from './types.ts'

const M_PER_DEG = (6_371_008.8 * Math.PI) / 180

export interface RouteHit {
  /** ルート上の距離 [m] */
  distanceM: number
  /** ルートからの距離 [m] */
  offsetM: number
}

export interface RouteGrid {
  /** 点に最も近いルート上の位置。maxOffsetM より離れていれば null */
  nearest(lat: number, lon: number, maxOffsetM: number): RouteHit | null
}

/**
 * ルートの区間を格子（既定 50 m 四方）に振り分け、点の近くの区間だけを調べて最寄りを探す。
 * 路上画像のように多くの点をルート全域から探すとき、全区間を毎回なめると
 * 画像数 × 区間数になり画面が固まるため（数千枚 × 1 万区間 = 数秒）。
 * 平面への投影はルートの始点の緯度で行う（峠 1 本の範囲なら誤差は無視できる）。
 */
export function buildRouteGrid(profile: readonly ProfilePoint[], cellM = 50): RouteGrid {
  const cos0 = Math.cos(((profile[0]?.lat ?? 0) * Math.PI) / 180)
  const toX = (lon: number) => lon * cos0 * M_PER_DEG
  const toY = (lat: number) => lat * M_PER_DEG
  const xs = profile.map((p) => toX(p.lon))
  const ys = profile.map((p) => toY(p.lat))
  const cells = new Map<string, number[]>()
  const cellOf = (v: number) => Math.floor(v / cellM)

  for (let i = 0; i < profile.length - 1; i++) {
    const x0 = cellOf(Math.min(xs[i]!, xs[i + 1]!))
    const x1 = cellOf(Math.max(xs[i]!, xs[i + 1]!))
    const y0 = cellOf(Math.min(ys[i]!, ys[i + 1]!))
    const y1 = cellOf(Math.max(ys[i]!, ys[i + 1]!))
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const key = `${cx},${cy}`
        const list = cells.get(key)
        if (list) list.push(i)
        else cells.set(key, [i])
      }
    }
  }

  return {
    nearest(lat, lon, maxOffsetM) {
      const px = toX(lon)
      const py = toY(lat)
      const seen = new Set<number>()
      let best: RouteHit | null = null
      let bestIndex = Infinity
      for (let cx = cellOf(px - maxOffsetM); cx <= cellOf(px + maxOffsetM); cx++) {
        for (let cy = cellOf(py - maxOffsetM); cy <= cellOf(py + maxOffsetM); cy++) {
          for (const i of cells.get(`${cx},${cy}`) ?? []) {
            if (seen.has(i)) continue
            seen.add(i)
            const ax = xs[i]! - px
            const ay = ys[i]! - py
            const dx = xs[i + 1]! - xs[i]!
            const dy = ys[i + 1]! - ys[i]!
            const len2 = dx * dx + dy * dy
            const t = len2 > 0 ? Math.min(1, Math.max(0, -(ax * dx + ay * dy) / len2)) : 0
            const offsetM = Math.hypot(ax + t * dx, ay + t * dy)
            if (offsetM > maxOffsetM) continue
            // 同じ近さなら始点に近い区間（全域をなめる探索と同じ結果にする）
            if (!best || offsetM < best.offsetM || (offsetM === best.offsetM && i < bestIndex)) {
              const a = profile[i]!
              const b = profile[i + 1]!
              best = { offsetM, distanceM: a.distanceM + t * (b.distanceM - a.distanceM) }
              bestIndex = i
            }
          }
        }
      }
      return best
    },
  }
}
