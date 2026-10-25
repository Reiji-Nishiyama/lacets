import { fileURLToPath } from 'node:url'
import { expect, test } from './fixtures.ts'

const fixture = (name: string) =>
  fileURLToPath(new URL(`../test/fixtures/${name}`, import.meta.url))

test('事前確認でルート名を変えられる', async ({ page }) => {
  await page.goto('/?sim=1')
  await page.getByTestId('route-file-input').setInputFiles(fixture('synthetic-lacets.gpx'))
  await page.getByRole('button', { name: /Synthetic Lacets/ }).click()

  // やめると元のまま
  await page.getByRole('button', { name: '名前を変える' }).click()
  await page.getByLabel('ルート名').fill('なしにする')
  await page.getByLabel('ルート名').press('Escape')
  await expect(page.getByRole('heading', { name: 'Synthetic Lacets' })).toBeVisible()

  await page.getByRole('button', { name: '名前を変える' }).click()
  await page.getByLabel('ルート名').fill('ラルプデュエズ（練習）')
  await page.getByLabel('ルート名').press('Enter')
  await expect(page.getByRole('heading', { name: 'ラルプデュエズ（練習）' })).toBeVisible()

  // 逆方向にしても新しい名前
  await page.getByLabel('逆方向に走る').check()
  await expect(page.getByRole('heading', { name: 'ラルプデュエズ（練習）' })).toBeVisible()

  await page.getByRole('button', { name: /ルート一覧/ }).click()
  await expect(page.getByRole('button', { name: /ラルプデュエズ（練習）/ })).toBeVisible()
})
