import { test as base, type Page } from '@playwright/test'

/**
 * すべての E2E で外部の路上画像 API を呼ばないようにする。既定は「画像なし」。
 * 個別のテストで page.route を上書きすれば模擬データを返せる。
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route('https://api.panoramax.xyz/**', (route) =>
      route.fulfill({ json: { type: 'FeatureCollection', features: [] } }),
    )
    await page.route('https://graph.mapillary.com/**', (route) =>
      route.fulfill({ json: { data: [] } }),
    )
    await use(page)
  },
})

export { expect } from '@playwright/test'
export type { Page } from '@playwright/test'

/**
 * 端末内（IndexedDB）に保存された設定を読む。設定の保存は非同期なので、再読み込みの前に
 * 保存の完了をこれで確かめる（保存が終わる前に再読み込みすると、最後の変更が失われる）
 */
export function readSavedSetting(page: Page, key: string): Promise<unknown> {
  return page.evaluate(
    `new Promise((resolve, reject) => {
      const open = indexedDB.open('lacets')
      open.onerror = () => reject(open.error)
      open.onsuccess = () => {
        const db = open.result
        const req = db.transaction('settings').objectStore('settings').get(${JSON.stringify(key)})
        req.onsuccess = () => { resolve(req.result?.value ?? null); db.close() }
        req.onerror = () => reject(req.error)
      }
    })`,
  )
}
