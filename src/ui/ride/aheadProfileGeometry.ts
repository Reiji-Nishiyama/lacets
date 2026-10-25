/** 走行中の「この先 2 km」の勾配図の形（docs/07-design.md） */

export interface AheadSlice {
  /** 区間の塗り（SVG の path） */
  path: string
  /** 区間の平均勾配（小数） */
  grade: number
  /** 勾配の数字を置く位置（区間の中央・稜線の少し上） */
  labelX: number
  labelY: number
}

export interface AheadGeometry {
  slices: AheadSlice[]
  /** 稜線（SVG の points） */
  line: string
  /** 窓の終わり。ゴールが近ければゴール */
  endM: number
  /** ゴールが窓の中にある */
  goalInWindow: boolean
  x: (distanceM: number) => number
  y: (elevationM: number) => number
  /** 次の 500 m（ゴールが近ければゴールまで）の平均勾配。残りが短すぎれば null */
  next500Grade: number | null
}

export interface AheadOptions {
  windowM: number
  sliceM: number
  /** 稜線を描く間隔 [m] */
  stepM: number
  width: number
  height: number
  /** 上の余白（勾配の数字の分） */
  top: number
  /** 左右の余白（現在地の丸の分） */
  padX: number
}

export const DEFAULT_AHEAD: AheadOptions = {
  windowM: 2000,
  sliceM: 250,
  stepM: 25,
  width: 440,
  height: 112,
  top: 24,
  padX: 8,
}

/**
 * 現在地から windowM 先までを sliceM ごとの区間に分け、区間の平均勾配で塗り分ける。
 * 横軸は常に windowM（ゴールが近づくと右側が空く）、縦軸は窓の中の標高に合わせる
 */
export function aheadProfileGeometry(
  elevationAt: (distanceM: number) => number,
  routeM: number,
  fromM: number,
  options: Partial<AheadOptions> = {},
): AheadGeometry {
  const o = { ...DEFAULT_AHEAD, ...options }
  const start = Math.max(0, Math.min(fromM, routeM))
  const endM = Math.min(start + o.windowM, routeM)
  const x = (d: number) => o.padX + ((d - start) / o.windowM) * (o.width - 2 * o.padX)

  const samples: number[] = []
  for (let d = start; d < endM; d += o.stepM) samples.push(d)
  samples.push(endM)
  const elevations = samples.map(elevationAt)
  let lo = Math.min(...elevations)
  let hi = Math.max(...elevations)
  // 平坦でも潰れないよう、最低 20 m の幅を持たせる
  const span = Math.max(hi - lo, 20)
  hi = lo + span
  lo -= span * 0.25
  const y = (e: number) => o.top + (1 - (e - lo) / (hi - lo)) * (o.height - o.top)
  const fmt = (v: number) => v.toFixed(1)

  const slices: AheadSlice[] = []
  for (let d = start; d < endM - 1e-6; d += o.sliceM) {
    const d1 = Math.min(endM, d + o.sliceM)
    const e0 = elevationAt(d)
    const e1 = elevationAt(d1)
    let path = `M${fmt(x(d))} ${o.height}`
    for (let k = d; k < d1; k += o.stepM) path += ` L${fmt(x(k))} ${fmt(y(elevationAt(k)))}`
    path += ` L${fmt(x(d1))} ${fmt(y(e1))} L${fmt(x(d1))} ${o.height} Z`
    slices.push({
      path,
      grade: (e1 - e0) / (d1 - d),
      labelX: (x(d) + x(d1)) / 2,
      labelY: Math.max(0, Math.min(y(e0), y(e1)) - 20),
    })
  }

  const remaining = endM - start
  const n500 = Math.min(500, remaining)
  return {
    slices,
    line: samples.map((d, i) => `${fmt(x(d))},${fmt(y(elevations[i]!))}`).join(' '),
    endM,
    goalInWindow: start + o.windowM >= routeM,
    x,
    y,
    next500Grade: n500 >= 100 ? (elevationAt(start + n500) - elevationAt(start)) / n500 : null,
  }
}
