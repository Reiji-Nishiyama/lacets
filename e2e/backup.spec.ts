import { fileURLToPath } from 'node:url'
import { expect, test } from './fixtures.ts'

const fixture = (name: string) =>
  fileURLToPath(new URL(`../test/fixtures/${name}`, import.meta.url))

test('バックアップを書き出し、別のブラウザに取り込める（M6）', async ({ page, browser }) => {
  // 保存ダイアログ（File System Access API）は操作できないので、ダウンロードリンクの経路を使う
  await page.addInitScript(() => {
    delete (globalThis as { showSaveFilePicker?: unknown }).showSaveFilePicker
  })
  await page.goto('/?sim=1')
  await page.getByTestId('route-file-input').setInputFiles(fixture('synthetic-lacets.gpx'))
  await expect(page.getByText('Synthetic Lacets を取り込みました')).toBeVisible()
  await page.getByRole('button', { name: '設定' }).click()
  await page.getByLabel('体重').fill('61.5')
  await page.getByLabel('Mapillary のアクセストークン').fill('MLY|secret')

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'バックアップを書き出す' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^lacets-backup-\d{8}\.json\.gz$/)
  await expect(page.getByText(/バックアップを書き出しました（ルート 1 件/)).toBeVisible()
  const backupPath = await download.path()

  // 何もない別のブラウザ（別の端末の代わり）
  const other = await browser.newContext()
  const page2 = await other.newPage()
  page2.on('dialog', (d) => void d.accept())
  await page2.goto('/?sim=1')
  await expect(page2.getByText('まだルートがありません', { exact: false })).toBeVisible()
  await page2.getByRole('button', { name: '設定' }).click()
  await page2.getByTestId('backup-file-input').setInputFiles(backupPath)
  await expect(page2.getByText('取り込みました（ルート 1 件')).toBeVisible()
  await expect(page2.getByLabel('体重')).toHaveValue('61.5')
  // トークンは持ち込まない
  await expect(page2.getByLabel('Mapillary のアクセストークン')).toHaveValue('')
  await page2.getByRole('button', { name: 'ルート', exact: true }).click()
  await expect(page2.getByRole('button', { name: /Synthetic Lacets/ })).toBeVisible()
  await other.close()
})
