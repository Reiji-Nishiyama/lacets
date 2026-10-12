import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { importRoute } from '../src/domain/course/importRoute.ts'
import { expect, test } from './fixtures.ts'

const fixturePath = fileURLToPath(new URL('../test/fixtures/synthetic-lacets.gpx', import.meta.url))
const route = importRoute(new Uint8Array(readFileSync(fixturePath)), 'x')

/** ルートの最初の 1 km に 20 m 間隔で並べた模擬パノラマ（Panoramax の検索結果の形） */
function fakePanoramaxFeatures(bbox: number[]) {
  const [w, s, e, n] = bbox as [number, number, number, number]
  return route.profile
    .filter((p) => p.distanceM <= 1000 && p.distanceM % 20 === 0)
    .filter((p) => p.lon >= w && p.lon < e && p.lat >= s && p.lat < n)
    .map((p) => ({
      type: 'Feature',
      id: `fake-${p.distanceM}`,
      geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
      properties: {
        datetime: '2025-07-01T10:00:00Z',
        license: 'CC-BY-SA-4.0',
        'view:azimuth': 0,
        'pers:interior_orientation': { field_of_view: 360 },
      },
      providers: [{ name: 'Test Rider', roles: ['producer'] }],
      assets: {
        sd: { href: `https://images.example/${p.distanceM}.svg` },
        thumb: { href: `https://images.example/${p.distanceM}.svg` },
      },
    }))
}

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect width="400" height="200" fill="#4a7"/></svg>`

test('路上画像のカバー率を表示し、走行中は画像と 3D 地形ビューを切り替えられる', async ({
  page,
}) => {
  await page.route('https://api.panoramax.xyz/api/search**', (r) => {
    const bbox = new URL(r.request().url()).searchParams.get('bbox')!.split(',').map(Number)
    return r.fulfill({ json: { type: 'FeatureCollection', features: fakePanoramaxFeatures(bbox) } })
  })
  await page.route('https://images.example/**', (r) =>
    r.fulfill({ body: SVG, contentType: 'image/svg+xml' }),
  )
  page.on('dialog', (d) => void d.accept())
  await page.goto('/?sim=1')
  await page.getByTestId('route-file-input').setInputFiles(fixturePath)
  await page.getByRole('button', { name: /Synthetic Lacets/ }).click()

  // 1 km / 13.8 km ≈ 7%
  await expect(page.getByTestId('street-coverage')).toContainText(/ルートの [5-9]% で路上画像/)
  await expect(page.getByTestId('street-coverage')).toContainText('Panoramax 51 枚')

  await page.getByRole('button', { name: 'トレーナーに接続' }).click()
  await page.getByRole('button', { name: '走行を開始' }).click()
  await expect(page.getByTestId('street-image')).toBeVisible()
  await expect(page.getByTestId('street-image-credit')).toHaveText(
    '© Test Rider / Panoramax（CC-BY-SA-4.0）',
  )

  // 3D 地形に切り替えると画像は消える（WebGL がない環境では案内が出る）
  await page.getByRole('tab', { name: '3D 地形' }).click()
  await expect(page.getByTestId('street-image')).toHaveCount(0)
  await page.getByRole('tab', { name: '路上画像' }).click()
  await expect(page.getByTestId('street-image')).toBeVisible()
})

test('Mapillary のトークンと MapTiler のキーを設定できる', async ({ page }) => {
  await page.goto('/?sim=1')
  await page.getByRole('button', { name: '設定' }).click()
  await page.getByLabel('Mapillary のアクセストークン').fill('MLY|test')
  await page.getByLabel('Panoramax の路上画像を使う（キー不要）').uncheck()
  await page.reload()
  await page.getByRole('button', { name: '設定' }).click()
  await expect(page.getByLabel('Mapillary のアクセストークン')).toHaveValue('MLY|test')
  await expect(page.getByLabel('Mapillary のアクセストークン')).toHaveAttribute('type', 'password')
  await expect(page.getByLabel('Panoramax の路上画像を使う（キー不要）')).not.toBeChecked()
  await expect(page.getByTestId('maptiler-usage')).toContainText(
    'この端末の今月の使用量（目安）: 0 / 100,000 リクエスト',
  )
})
