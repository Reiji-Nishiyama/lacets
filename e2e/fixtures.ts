import { test as base } from '@playwright/test'

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
