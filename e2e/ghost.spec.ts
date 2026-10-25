import { expect, test, type Page } from './fixtures.ts'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { importRoute } from '../src/domain/course/importRoute.ts'
import { referenceToGpx } from '../test/helpers/gpxWriter.ts'
import { simulatedReference } from '../test/helpers/simulatedReference.ts'

const fixturePath = fileURLToPath(new URL('../test/fixtures/synthetic-lacets.gpx', import.meta.url))

async function importAndOpen(page: Page) {
  page.on('dialog', (d) => void d.accept())
  await page.goto('/?sim=1')
  await page.getByTestId('route-file-input').setInputFiles(fixturePath)
  await page.getByRole('button', { name: /Synthetic Lacets/ }).click()
  await page.getByRole('button', { name: 'トレーナーに接続' }).click()
}

async function rideAndFinish(page: Page, seconds: number) {
  await page.getByRole('button', { name: '走りはじめる' }).click()
  await expect(page.getByTestId('ride-status')).toHaveText('走行中')
  await page.waitForTimeout(seconds * 1000)
  await page.getByRole('button', { name: '終了' }).click()
  await expect(page.getByTestId('ride-summary')).toBeVisible()
}

test('前年の実走データをゴーストにして走り、区間比較を見られる', async ({ page }) => {
  await importAndOpen(page)

  // 合成ルートを 200 W で走った「前年の実走」を GPX にして追加する
  const route = importRoute(new Uint8Array(readFileSync(fixturePath)), 'x')
  const sim = simulatedReference(route.profile, { powerW: 200, waitS: 20 })
  const gpx = referenceToGpx('2025 実走', Date.parse('2025-06-08T06:30:00Z'), sim.samples)
  await page.getByTestId('ghost-file-input').setInputFiles({
    name: '2025.gpx',
    mimeType: 'application/gpx+xml',
    buffer: Buffer.from(gpx),
  })
  await expect(page.getByText('2025 実走 を追加しました')).toBeVisible()
  await expect(page.getByLabel('ゴースト')).toHaveValue(/^reference:/)

  await page.getByRole('button', { name: '走りはじめる' }).click()
  // ゴーストの開始地点を過ぎると差が出る
  await expect(page.getByTestId('ride-ghost-delta')).not.toHaveText('—', { timeout: 15_000 })
  await expect(page.getByTestId('minimap-ghost')).toBeAttached()
  await page.getByRole('button', { name: '終了' }).click()

  const report = page.getByTestId('ride-report')
  await expect(report.getByText('ゴースト: 2025 実走')).toBeVisible()
  await report.getByRole('tab', { name: '1 km ごと' }).click()
  // 数十メートルしか走らないので、1 km ごとの区間は最初の端数の 1 行だけ
  await expect(report.locator('tbody tr')).toHaveCount(1)
  await expect(report.locator('tbody tr td').first()).toHaveText(/^0\.0–0\.0 km$/)
})

test('同じルートの過去の走行をゴーストにでき、履歴から見返せる', async ({ page }) => {
  await importAndOpen(page)
  await rideAndFinish(page, 3)
  await page.getByRole('button', { name: 'ルート一覧へ' }).click()

  await page.getByRole('button', { name: /Synthetic Lacets/ }).click()
  const picker = page.getByLabel('ゴースト')
  await picker.selectOption({ index: 1 })
  await expect(picker).toHaveValue(/^ride:/)
  await page.getByRole('button', { name: '走りはじめる' }).click()
  await expect(page.getByTestId('ride-ghost-delta')).not.toHaveText('—', { timeout: 5_000 })
  await page.waitForTimeout(2000)
  await page.getByRole('button', { name: '終了' }).click()
  await expect(page.getByTestId('ride-report')).toBeVisible()
  await page.getByRole('button', { name: 'ルート一覧へ' }).click()

  // 履歴
  await page.getByRole('button', { name: '履歴' }).click()
  const items = page.locator('.ride-list li')
  await expect(items).toHaveCount(2)
  // カレンダーで走った日を選ぶと、その日の走行だけになる（2 回とも今日）
  await expect(page.getByTestId('month-totals')).toContainText('2 回')
  await page.getByRole('button', { name: /（2 回走行）/ }).click()
  await expect(page.getByRole('heading', { name: /日の走行$/ })).toBeVisible()
  await expect(items).toHaveCount(2)
  await page.getByRole('button', { name: '月のすべてを表示' }).click()
  await expect(page.getByRole('heading', { name: /月の走行$/ })).toBeVisible()
  await items.first().getByRole('button').click()
  await expect(page.getByTestId('ride-report')).toBeVisible()
  await expect(page.getByTestId('ride-track-map')).toBeVisible()
  await expect(page.getByText('平均速度')).toBeVisible()
  await expect(page.getByRole('button', { name: 'FIT ファイルを書き出す' })).toBeVisible()
})
