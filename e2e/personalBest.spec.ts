import { fileURLToPath } from 'node:url'
import { expect, test } from './fixtures.ts'

const fixture = (name: string) =>
  fileURLToPath(new URL(`../test/fixtures/${name}`, import.meta.url))

test('走り切った記録が自己ベストになり、ゴーストの選択と履歴でわかる', async ({ page }) => {
  await page.goto('/?sim=1')
  await page.getByTestId('route-file-input').setInputFiles(fixture('short-flat.gpx'))
  await page.getByRole('button', { name: /Short Flat/ }).click()
  await expect(page.getByTestId('best-ride')).toHaveCount(0)

  // ゴールまで走る（67 m）
  await page.getByRole('button', { name: 'トレーナーに接続' }).click()
  await page.getByRole('button', { name: '走りはじめる' }).click()
  await expect(page.getByTestId('ride-report')).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'ルート一覧へ' }).click()

  // 事前確認: 自己ベストのタイム。押すとゴーストに選ばれる
  await page.getByRole('button', { name: /Short Flat/ }).click()
  const best = page.getByTestId('best-ride')
  await expect(best).toContainText(/自己ベスト 0:\d\d/)
  await best.click()
  await expect(best).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByLabel('ゴースト').locator('option:checked')).toHaveText(
    /^★ 過去の走行: .*（0:\d\d 自己ベスト）$/,
  )

  // 履歴にも印
  await page.getByRole('button', { name: '履歴' }).click()
  await expect(page.getByTestId('history-best')).toHaveCount(1)
})
