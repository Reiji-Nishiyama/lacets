import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from './fixtures.ts'

const fixturePath = fileURLToPath(new URL('../test/fixtures/synthetic-lacets.gpx', import.meta.url))

async function openPreview(page: Page) {
  page.on('dialog', (d) => void d.accept())
  await page.goto('/?sim=1')
  await page.getByTestId('route-file-input').setInputFiles(fixturePath)
  await page.getByRole('button', { name: /Synthetic Lacets/ }).click()
}

test('逆方向にすると獲得標高と下りが入れ替わり、そのまま走れる（#6）', async ({ page }) => {
  await openPreview(page)
  await expect(page.getByTestId('stat-ascent')).toHaveText('1,123')
  await page.getByLabel('逆方向に走る').check()
  await expect(page.getByTestId('stat-ascent')).toHaveText('0')
  await expect(page.getByTestId('stat-descent')).toHaveText('1,123')
  await expect(page.getByTestId('stat-distance')).toHaveText('13.8')

  await page.getByRole('button', { name: 'トレーナーに接続' }).click()
  await page.getByRole('button', { name: '走りはじめる' }).click()
  // 逆方向の始点は下り
  await expect(page.getByTestId('ride-grade')).toHaveText(/^-/)
  await page.getByRole('button', { name: '終了' }).click()
  await expect(page.getByTestId('ride-summary')).toBeVisible()
})

test('ルートの途中の地点から走り始められる（#5）', async ({ page }) => {
  await openPreview(page)
  await expect(page.getByTestId('start-point-value')).toHaveText('ルートの始点から走ります')
  await page.getByRole('slider', { name: '開始地点' }).fill('5000')
  await expect(page.getByTestId('start-point-value')).toContainText('5.0 km 地点')
  await expect(page.getByTestId('start-point-value')).toContainText('残り 8.8 km')
  await expect(page.getByTestId('profile-start-marker')).toBeAttached()

  await page.getByRole('button', { name: 'トレーナーに接続' }).click()
  await page.getByRole('button', { name: '走りはじめる' }).click()
  await expect(page.getByTestId('ride-status')).toHaveText('走行中')
  // 距離は走った距離（0 から）、残りは開始地点から
  await expect(page.getByTestId('ride-distance')).toHaveText(/^0\.0/)
  await expect(page.getByTestId('ride-remaining')).toHaveText(/^8\.8/)
  await page.waitForTimeout(2000)
  await page.getByRole('button', { name: '終了' }).click()
  await expect(page.getByTestId('summary-distance')).toHaveText(/^0\.0/)

  // 始点に戻せる
  await page.getByRole('button', { name: 'ルート一覧へ' }).click()
  await page.getByRole('button', { name: /Synthetic Lacets/ }).click()
  await expect(page.getByTestId('start-point-value')).toHaveText('ルートの始点から走ります')
})
