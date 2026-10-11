import { expect, test } from '@playwright/test'

test('トップ画面が表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('Lacets')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Lacets')
})
