import { expect, test } from './fixtures.ts'

test.describe('デバイス接続（シミュレータ）', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?sim=1')
    await page.getByRole('button', { name: 'デバイス' }).click()
    await page.getByRole('button', { name: 'トレーナーに接続' }).click()
    await expect(page.getByTestId('trainer-state')).toHaveText('接続済み')
  })

  test('パワーとケイデンスが表示され、勾配を上げるとパワーが上がる', async ({ page }) => {
    const power = page.getByTestId('power')
    await expect(power).not.toHaveText('—')
    await expect(page.getByTestId('cadence')).not.toHaveText('—')
    const flatPowerW = Number(await power.textContent())
    expect(flatPowerW).toBeGreaterThan(180)
    expect(flatPowerW).toBeLessThan(220)

    await page.getByRole('slider', { name: '勾配' }).fill('8')
    await expect(page.getByTestId('grade-value')).toHaveText('8.0%')
    // grade モードでは 8% で約 1.3 倍（264 W ± ゆらぎ）
    await expect
      .poll(async () => Number(await power.textContent()), { timeout: 3000 })
      .toBeGreaterThan(240)
  })

  test('心拍計に接続できる', async ({ page }) => {
    await page.getByRole('button', { name: '心拍計に接続' }).click()
    await expect(page.getByTestId('heart-rate-state')).toHaveText('接続済み')
    await expect(page.getByTestId('heart-rate')).not.toHaveText('—')
  })

  test('一時的な切断から自動で復帰する', async ({ page }) => {
    await page.getByRole('button', { name: '一時的な切断を再現' }).click()
    await expect(page.getByTestId('trainer-state')).toHaveText('再接続中…')
    await expect(page.getByTestId('power')).toHaveText('—')
    await expect(page.getByTestId('trainer-state')).toHaveText('接続済み', { timeout: 5000 })
    await expect(page.getByTestId('power')).not.toHaveText('—')
  })

  test('切断できる', async ({ page }) => {
    await page.getByRole('button', { name: '切断' }).first().click()
    await expect(page.getByTestId('trainer-state')).toHaveText('未接続')
  })

  test('勾配テストを記録して CSV に書き出せる（#7）', async ({ page }) => {
    await page.addInitScript(() => {
      delete (globalThis as { showSaveFilePicker?: unknown }).showSaveFilePicker
    })
    await page.reload()
    await page.getByRole('button', { name: 'デバイス' }).click()
    await page.getByRole('button', { name: 'トレーナーに接続' }).click()
    await page.getByRole('button', { name: '記録を開始' }).click()
    await page.getByRole('slider', { name: '勾配' }).fill('4')
    await expect(page.getByTestId('grade-test-count')).toHaveText(/^[3-9] 秒分を記録$/, {
      timeout: 6000,
    })
    await page.getByRole('button', { name: '記録を停止' }).click()
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'CSV を書き出す' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/^lacets-grade-test-\d{8}-\d{4}\.csv$/)
    const { readFile } = await import('node:fs/promises')
    const csv = await readFile(await download.path(), 'utf8')
    expect(csv).toContain('time,elapsed_s,grade_pct,power_w')
    expect(csv).toMatch(/,4\.00,\d+,/)
  })
})
