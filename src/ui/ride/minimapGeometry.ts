import type { ProfilePoint } from '../../domain/course/types.ts'

export interface MinimapGeometry {
  /** SVG の points 属性の文字列（全体） */
  all: string
  /** 距離 d までの部分の points 文字列 */
  until: (distanceM: number) => string
  /** 距離 d の位置 */
  pointAt: (distanceM: number) => { x: number; y: number }
}

const M_PER_DEG = (6_371_008.8 * Math.PI) / 180
/** 描く点の数の上限（長いルートでも軽く） */
const MAX_POINTS = 400

/**
 * ルートを width×height の枠に収まるよう平面に投影する（北が上、縦横比は保つ）。
 * 小さな地図はルートの形だけを描くので、地図タイルも WebGL も使わない
 */
export function minimapGeometry(
  profile: readonly ProfilePoint[],
  width: number,
  height: number,
  padding: number,
): MinimapGeometry {
  const step = Math.max(1, Math.ceil(profile.length / MAX_POINTS))
  const pts = profile.filter((_, i) => i % step === 0 || i === profile.length - 1)
  const lat0 = pts[0]?.lat ?? 0
  const cos = Math.cos((lat0 * Math.PI) / 180)
  const xy = pts.map((p) => ({ x: p.lon * cos * M_PER_DEG, y: -p.lat * M_PER_DEG, d: p.distanceM }))
  const xs = xy.map((p) => p.x)
  const ys = xy.map((p) => p.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const spanX = Math.max(1, Math.max(...xs) - minX)
  const spanY = Math.max(1, Math.max(...ys) - minY)
  const scale = Math.min((width - 2 * padding) / spanX, (height - 2 * padding) / spanY)
  const offX = (width - spanX * scale) / 2
  const offY = (height - spanY * scale) / 2
  const proj = xy.map((p) => ({
    x: offX + (p.x - minX) * scale,
    y: offY + (p.y - minY) * scale,
    d: p.d,
  }))
  const fmt = (ps: { x: number; y: number }[]) =>
    ps.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

  const pointAt = (distanceM: number) => {
    const i = proj.findIndex((p) => p.d >= distanceM)
    if (i <= 0) return i === 0 ? proj[0]! : proj[proj.length - 1]!
    const a = proj[i - 1]!
    const b = proj[i]!
    const t = b.d > a.d ? (distanceM - a.d) / (b.d - a.d) : 0
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
  }

  return {
    all: fmt(proj),
    until: (distanceM) => fmt([...proj.filter((p) => p.d < distanceM), pointAt(distanceM)]),
    pointAt,
  }
}
