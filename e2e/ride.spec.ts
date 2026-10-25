import { Decoder, Stream } from '@garmin/fitsdk'
import { expect, test } from './fixtures.ts'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const fixture = (name: string) =>
  fileURLToPath(new URL(`../test/fixtures/${name}`, import.meta.url))

test('ルートを取り込んで走り、一時停止・再開・終了して FIT を書き出せる', async ({ page }) => {
  page.on('dialog', (d) => void d.accept())
  // 保存ダイアログ（File System Access API）は操作できないので、ダウンロードリンクの経路を使う
  await page.addInitScript(() => {
    delete (globalThis as { showSaveFilePicker?: unknown }).showSaveFilePicker
  })
  await page.goto('/?sim=1')

  // 取り込み
  await page.getByTestId('route-file-input').setInputFiles(fixture('synthetic-lacets.gpx'))
  await expect(page.getByText('Synthetic Lacets を取り込みました')).toBeVisible()
  await page.getByRole('button', { name: /Synthetic Lacets/ }).click()

  // 事前確認
  await expect(page.getByRole('heading', { name: 'Synthetic Lacets' })).toBeVisible()
  await expect(page.getByTestId('stat-distance')).toHaveText('13.8')
  await expect(page.getByRole('img', { name: '勾配プロファイル' })).toBeVisible()

  // トレーナーを接続して開始
  await page.getByRole('button', { name: 'トレーナーに接続' }).click()
  await page.getByRole('button', { name: '走行を開始' }).click()
  await expect(page.getByTestId('ride-status')).toHaveText('走行中')
  await expect
    .poll(async () => Number(await page.getByTestId('ride-distance').textContent()), {
      timeout: 5000,
    })
    .toBeGreaterThan(0)
  await expect(page.getByTestId('ride-power')).not.toHaveText('—')

  // 一時停止・再開
  await page.getByRole('button', { name: '一時停止' }).click()
  await expect(page.getByTestId('ride-status')).toHaveText('一時停止中')
  const pausedAt = await page.getByTestId('ride-elapsed').textContent()
  await page.waitForTimeout(1500)
  await expect(page.getByTestId('ride-elapsed')).toHaveText(pausedAt ?? '')
  await page.getByRole('button', { name: '再開' }).click()
  await expect(page.getByTestId('ride-status')).toHaveText('走行中')

  // 終了
  await page.getByRole('button', { name: '終了' }).click()
  await expect(page.getByTestId('ride-status')).toHaveText('ゴール')
  await expect(page.getByTestId('ride-summary')).toBeVisible()
  await expect(page.getByTestId('summary-save-state')).toHaveText(
    '走行記録をこの端末に保存しました',
  )

  // FIT の書き出し
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'FIT ファイルを書き出す' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^lacets-\d{8}-\d{4}-Synthetic_Lacets\.fit$/)
  const bytes = new Uint8Array(await readFile(await download.path()))
  const decoder = new Decoder(Stream.fromByteArray(bytes))
  expect(decoder.checkIntegrity()).toBe(true)
  const { messages } = new Decoder(Stream.fromByteArray(bytes)).read()
  expect(messages.sessionMesgs?.[0]?.subSport).toBe('virtualActivity')
  expect(messages.recordMesgs?.length).toBeGreaterThan(0)
  expect(messages.recordMesgs?.[0]?.positionLat).toBeDefined()

  await page.getByRole('button', { name: 'ルート一覧へ' }).click()
  await expect(page.getByRole('heading', { name: 'ルート', exact: true })).toBeVisible()
})

test('ライダー設定を保存できる', async ({ page }) => {
  await page.goto('/?sim=1')
  await page.getByRole('button', { name: '設定' }).click()
  await page.getByLabel('体重').fill('58')
  await page.getByLabel('ポジション').selectOption('climbing')
  // 保存（IndexedDB）は非同期なので、反映されるまで再読み込みして確かめる
  await expect(async () => {
    await page.reload()
    await page.getByRole('button', { name: '設定' }).click()
    await expect(page.getByLabel('体重')).toHaveValue('58', { timeout: 3000 })
    await expect(page.getByLabel('ポジション')).toHaveValue('climbing', { timeout: 3000 })
  }).toPass({ timeout: 10_000 })
})
