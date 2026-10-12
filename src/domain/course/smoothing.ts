/** 標高の平滑化フィルタ。窓は中心から片側 halfWindow 点。 */

/** 中央値フィルタ。端では窓を左右対称のまま縮める */
export function medianFilter(values: number[], halfWindow: number): number[] {
  if (halfWindow <= 0) return [...values]
  const n = values.length
  return values.map((_, i) => {
    const h = Math.min(halfWindow, i, n - 1 - i)
    const w = values.slice(i - h, i + h + 1).sort((a, b) => a - b)
    return w[h]!
  })
}

/**
 * 局所線形回帰による平滑化。各点で窓内の点に最小二乗で直線を当てはめ、その点での値を返す。
 * 窓が左右対称な内部では移動平均と一致する。端では窓が片側に寄るが、直線を当てはめるので
 * 登りの端で勾配が潰れず、ノイズも均せる。累積和で O(n)。
 */
export function localLinearSmooth(values: number[], halfWindow: number): number[] {
  const n = values.length
  if (halfWindow <= 0 || n < 3) return [...values]
  // x = インデックス、y = 値の累積和
  const sy = [0]
  const sxy = [0]
  for (let i = 0; i < n; i++) {
    sy.push(sy[i]! + values[i]!)
    sxy.push(sxy[i]! + i * values[i]!)
  }
  const sumX = (a: number, b: number) => ((b - a + 1) * (a + b)) / 2
  const sumXX = (a: number, b: number) => {
    const f = (k: number) => (k * (k + 1) * (2 * k + 1)) / 6
    return f(b) - (a > 0 ? f(a - 1) : 0)
  }
  return values.map((_, i) => {
    const a = Math.max(0, i - halfWindow)
    const b = Math.min(n - 1, i + halfWindow)
    const m = b - a + 1
    const Sx = sumX(a, b)
    const Sxx = sumXX(a, b)
    const Sy = sy[b + 1]! - sy[a]!
    const Sxy = sxy[b + 1]! - sxy[a]!
    const denom = m * Sxx - Sx * Sx
    if (denom === 0) return Sy / m
    const slope = (m * Sxy - Sx * Sy) / denom
    const intercept = (Sy - slope * Sx) / m
    return intercept + slope * i
  })
}
