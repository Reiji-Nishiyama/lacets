/**
 * 端末ごとのちょっとした記録（localStorage）。プライベートモード等で使えない場合は何もしない。
 * 確実に残す必要のあるデータは IndexedDB（Dexie）に置き、ここには置かない。
 */
export function readLocal(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null
  } catch {
    return null
  }
}

export function writeLocal(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value)
  } catch {
    // 保存できなくても動作には影響しない
  }
}
