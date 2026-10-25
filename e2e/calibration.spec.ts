import { expect, test } from './fixtures.ts'

test('勾配テストからトレーナーの想定総重量を推定して補正を設定できる（#7）', async ({ page }) => {
  // 1 分以上の記録が必要なので、ブラウザの時計を早送りする
  await page.clock.install()
  await page.goto('/?sim=1')

  // 総重量 68.8 kg（体重 61.5 + バイク 7.3）
  await page.getByRole('button', { name: '設定' }).click()
  await page.getByLabel('体重').fill('61.5')
  await page.getByLabel('バイク重量').fill('7.3')
  await expect(page.getByLabel('路面')).toHaveValue('normal')

  await page.getByRole('button', { name: 'デバイス' }).click()
  await page.getByRole('button', { name: 'トレーナーに接続' }).click()
  await page.getByRole('slider', { name: '勾配' }).fill('9')
  await page.getByRole('button', { name: '記録を開始' }).click()
  await page.clock.runFor(70_000)
  await page.getByRole('button', { name: '記録を停止' }).click()

  // シミュレータは想定総重量 82 kg のトレーナーとして振る舞う
  const estimate = page.getByTestId('trainer-mass-estimate')
  await expect(estimate).toContainText(/想定している総重量: 8[12]\.\d kg/)
  await expect(estimate).toContainText('設定の総重量 68.8 kg')
  await estimate.getByRole('button', { name: 'この値で補正する' }).click()
  await expect(estimate).toContainText(/勾配を 0\.8[34] 倍/)

  await page.getByRole('button', { name: '設定' }).click()
  await expect(page.getByTestId('trainer-ratio')).toContainText(/送る勾配の倍率: 0\.8[34]/)
  await page.getByRole('button', { name: '補正しない' }).click()
  await expect(page.getByTestId('trainer-ratio')).toHaveCount(0)
})
