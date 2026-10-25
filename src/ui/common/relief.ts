/**
 * 標高の帯の色と等高線の間隔（docs/07-design.md）。勾配図と地図で同じ色の段を使う。
 * 色はルートの最低点 → 最高点に、--relief-0（薄い若草色）→ --relief-5（濃い緑）を割り当てる
 */
export const RELIEF_COLORS = ['#e6f2e2', '#d1e8cb', '#badcb8', '#a1cfa6', '#87c095', '#6daf86']

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** 0〜1 の位置に応じた色（RELIEF_COLORS を線形補間） */
export function reliefColor(fraction: number): string {
  const f = Math.min(1, Math.max(0, fraction)) * (RELIEF_COLORS.length - 1)
  const i = Math.min(RELIEF_COLORS.length - 2, Math.floor(f))
  const t = f - i
  const a = hexToRgb(RELIEF_COLORS[i]!)
  const b = hexToRgb(RELIEF_COLORS[i + 1]!)
  const c = a.map((v, k) => Math.round(v + (b[k]! - v) * t))
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

/** 等高線の間隔 [m]。帯が 4〜14 本程度になる、きりのよい値 */
export function contourIntervalM(minM: number, maxM: number): number {
  const range = Math.max(1, maxM - minM)
  for (const step of [10, 20, 50, 100, 200, 500]) {
    if (range / step <= 14) return step
  }
  return 1000
}
