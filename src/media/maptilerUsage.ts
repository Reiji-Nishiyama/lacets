import { readLocal, writeLocal } from '../platform/localStore.ts'

/**
 * MapTiler の無料プランの使用量の目安（この端末から送ったリクエスト数）。
 * 無料プランは月 100,000 リクエストで、超えると翌月までサービスが止まる（docs/04）。
 * ブラウザのキャッシュから返ったタイルも数えるので、実際の請求上の数より多めに出る。
 */
export const MAPTILER_FREE_MONTHLY_REQUESTS = 100_000

/** 512px の画像タイル（衛星画像など）は 1 枚で 4 リクエスト、それ以外は 1 と数えられる */
export function maptilerRequestWeight(url: string): number {
  return /\/tiles\/[^?]+\.(jpg|jpeg|png|webp)(\?|$)/.test(url) ? 4 : 1
}

export function isMaptilerUrl(url: string): boolean {
  return url.startsWith('https://api.maptiler.com/')
}

/** 月の区切り（UTC） */
export function usageMonthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

const storageKey = (month: string) => `lacets.maptilerUsage.${month}`

let pendingMonth: string | null = null
let pendingCount = 0
let flushTimer: ReturnType<typeof setTimeout> | null = null

/** 地図が MapTiler にリクエストするたびに呼ぶ（書き込みはまとめて行う） */
export function countMaptilerRequest(url: string, now = new Date()): void {
  if (!isMaptilerUrl(url)) return
  const month = usageMonthKey(now)
  if (pendingMonth !== month) flushMaptilerUsage()
  pendingMonth = month
  pendingCount += maptilerRequestWeight(url)
  flushTimer ??= setTimeout(flushMaptilerUsage, 2000)
}

export function flushMaptilerUsage(): void {
  if (flushTimer !== null) clearTimeout(flushTimer)
  flushTimer = null
  if (!pendingMonth || pendingCount === 0) return
  const key = storageKey(pendingMonth)
  writeLocal(key, String((Number(readLocal(key)) || 0) + pendingCount))
  pendingCount = 0
}

/** この端末の今月の使用量の目安 */
export function maptilerUsageThisMonth(now = new Date()): number {
  const month = usageMonthKey(now)
  const pending = pendingMonth === month ? pendingCount : 0
  return (Number(readLocal(storageKey(month))) || 0) + pending
}
