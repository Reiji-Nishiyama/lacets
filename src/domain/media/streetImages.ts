import type { ProfilePoint } from '../course/types.ts'
import { buildRouteGrid } from '../course/routeGrid.ts'

export type StreetImageProvider = 'panoramax' | 'mapillary'

/** 路上画像 1 枚（プロバイダーによらない共通の形） */
export interface StreetImage {
  provider: StreetImageProvider
  id: string
  lat: number
  lon: number
  /** 撮影方向（北 = 0、時計回り）。パノラマなら画像の中心の方向 */
  azimuthDeg: number | null
  /** 360° パノラマ（正距円筒図法） */
  isPano: boolean
  capturedAtMs: number | null
  /** 表示用の画像（パノラマなら正距円筒図法の全体） */
  imageUrl: string
  thumbUrl: string
  /** クレジット表記（撮影者、ライセンス） */
  creator: string | null
  license: string | null
}

/** ルートに載せた路上画像 */
export interface RouteImage {
  image: StreetImage
  /** ルート上の距離 [m] */
  distanceM: number
  offsetM: number
}

export interface ImageIndexOptions {
  /** ルートからこれ以上離れた画像は使わない [m] */
  maxOffsetM: number
  /** 平面画像は、撮影方向と進行方向の差がこれ以内のものだけ使う [deg] */
  maxHeadingDiffDeg: number
}

export const DEFAULT_IMAGE_INDEX: ImageIndexOptions = { maxOffsetM: 20, maxHeadingDiffDeg: 45 }

/** 角度の差（0〜180） */
export function angleDiffDeg(a: number, b: number): number {
  const d = Math.abs((((a - b) % 360) + 360) % 360)
  return d > 180 ? 360 - d : d
}

/**
 * 画像をルート上の距離に並べる（docs/02 §9）。ルートから離れた画像と、
 * 進行方向を向いていない平面画像（逆向きの撮影など）を除く。パノラマは向きを問わない。
 * 画像は撮影順ではないので 1 枚ずつルート全域から最寄りを探す。画像が数千枚になっても
 * 固まらないよう、ルートの区間を格子に振り分けて近くだけを調べる（routeGrid.ts）。
 */
export function indexImagesAlongRoute(
  profile: readonly ProfilePoint[],
  images: readonly StreetImage[],
  headingAt: (distanceM: number) => number,
  options: Partial<ImageIndexOptions> = {},
): RouteImage[] {
  const opts = { ...DEFAULT_IMAGE_INDEX, ...options }
  const out: RouteImage[] = []
  const grid = buildRouteGrid(profile)
  for (const image of images) {
    const hit = grid.nearest(image.lat, image.lon, opts.maxOffsetM)
    if (!hit) continue
    if (!image.isPano) {
      if (image.azimuthDeg === null) continue
      if (angleDiffDeg(image.azimuthDeg, headingAt(hit.distanceM)) > opts.maxHeadingDiffDeg)
        continue
    }
    out.push({ image, distanceM: hit.distanceM, offsetM: hit.offsetM })
  }
  return out.sort((a, b) => a.distanceM - b.distanceM)
}

export interface ImageSelectOptions {
  /** 現在地からこれだけ後ろまでの画像を候補にする [m] */
  behindM: number
  /** 現在地からこれだけ先までの画像を候補にする [m] */
  aheadM: number
  /** 撮影の新しさの比較に使う現在時刻（Unix ms） */
  nowMs: number
}

export const DEFAULT_IMAGE_SELECT: Omit<ImageSelectOptions, 'nowMs'> = { behindM: 25, aheadM: 15 }

/**
 * 現在地で表示する画像。[d − behind, d + ahead] の中で現在地に最も近いもの。
 * 同じくらい近ければ新しい撮影を優先する。なければ null（3D 地形ビューに切り替える）
 */
export function imageAt(
  index: readonly RouteImage[],
  distanceM: number,
  options: Partial<ImageSelectOptions> = {},
): RouteImage | null {
  const opts = { ...DEFAULT_IMAGE_SELECT, nowMs: 0, ...options }
  const lo = lowerBound(index, distanceM - opts.behindM)
  let best: RouteImage | null = null
  let bestScore = Infinity
  for (let i = lo; i < index.length; i++) {
    const r = index[i]!
    if (r.distanceM > distanceM + opts.aheadM) break
    // 距離の差 [m] に、古い撮影ほど少し不利になる重みを足す（1 年で 2 m 相当）。
    // nowMs を渡さなければ撮影時刻だけで比べる（新しいほど有利なのは同じ）
    const ageYears = r.image.capturedAtMs ? (opts.nowMs - r.image.capturedAtMs) / 3.15e10 : 50
    const score = Math.abs(r.distanceM - distanceM) + 2 * ageYears
    if (score < bestScore) {
      best = r
      bestScore = score
    }
  }
  return best
}

/** [fromM, toM] の画像（先読み用） */
export function imagesBetween(
  index: readonly RouteImage[],
  fromM: number,
  toM: number,
): RouteImage[] {
  const out: RouteImage[] = []
  for (let i = lowerBound(index, fromM); i < index.length && index[i]!.distanceM <= toM; i++) {
    out.push(index[i]!)
  }
  return out
}

/** ルートのうち画像が表示される割合（10 m ごとに imageAt があるか） */
export function imageCoverage(
  index: readonly RouteImage[],
  routeM: number,
  options: Partial<ImageSelectOptions> = {},
): number {
  if (routeM <= 0) return 0
  let covered = 0
  let total = 0
  for (let d = 0; d <= routeM; d += 10) {
    total++
    if (imageAt(index, d, options)) covered++
  }
  return covered / total
}

function lowerBound(index: readonly RouteImage[], value: number): number {
  let lo = 0
  let hi = index.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (index[mid]!.distanceM < value) lo = mid + 1
    else hi = mid
  }
  return lo
}

/**
 * パノラマ（正距円筒図法）で、見たい方向を画面の中央に置くための横位置（画像幅に対する割合 0〜1）。
 * 画像の中央の列が azimuthDeg の方向を向いている前提
 */
export function panoCenterFraction(azimuthDeg: number | null, viewHeadingDeg: number): number {
  const f = 0.5 + (viewHeadingDeg - (azimuthDeg ?? 0)) / 360
  return ((f % 1) + 1) % 1
}

/**
 * ルートに沿って画像を検索する範囲（緯度経度の小さな矩形）。
 * Mapillary の bbox は 0.01 度四方未満という制限があるので、cellDeg 四方のマス目で区切る
 */
export function searchCellsAlongRoute(
  profile: readonly ProfilePoint[],
  cellDeg = 0.005,
): [number, number, number, number][] {
  const keys = new Set<string>()
  const cells: [number, number, number, number][] = []
  for (const p of profile) {
    const ix = Math.floor(p.lon / cellDeg)
    const iy = Math.floor(p.lat / cellDeg)
    const key = `${ix},${iy}`
    if (keys.has(key)) continue
    keys.add(key)
    const r = (n: number) => Math.round(n * 1e6) / 1e6
    cells.push([r(ix * cellDeg), r(iy * cellDeg), r((ix + 1) * cellDeg), r((iy + 1) * cellDeg)])
  }
  return cells
}
