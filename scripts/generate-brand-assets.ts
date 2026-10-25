/**
 * ロゴ（src/ui/brand/logo.ts）からファビコン・PWA アイコン・README 用の画像を書き出す。
 * ロゴを変えたら `npm run brand` で作り直す（public/ の SVG が古いとユニットテストが失敗する）。
 * PNG は Playwright の Chromium で描く。
 */
import { writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { badgeSvg, squareIconSvg } from '../src/ui/brand/logo.ts'
import { BRAND_SVG_FILES } from '../src/ui/brand/assets.ts'

const root = new URL('../', import.meta.url)

for (const [path, svg] of Object.entries(BRAND_SVG_FILES)) {
  await writeFile(new URL(path, root), svg + '\n')
  console.log(`書き出し: ${path}`)
}

const pngs: { path: string; svg: string; size: number; transparent: boolean }[] = [
  { path: 'public/icon-192.png', svg: squareIconSvg(), size: 192, transparent: false },
  { path: 'public/icon-512.png', svg: squareIconSvg(), size: 512, transparent: false },
  { path: 'public/apple-touch-icon.png', svg: squareIconSvg(), size: 180, transparent: false },
  {
    path: 'docs/brand/lacets-badge-rider.png',
    svg: badgeSvg({ rider: true }),
    size: 512,
    transparent: true,
  },
]

const browser = await chromium.launch()
try {
  for (const { path, svg, size, transparent } of pngs) {
    const page = await browser.newPage({ viewport: { width: size, height: size } })
    await page.setContent(
      `<!doctype html><html><body style="margin:0;background:transparent">` +
        svg.replace('<svg ', `<svg width="${size}" height="${size}" `) +
        `</body></html>`,
    )
    await page.screenshot({ path: new URL(path, root).pathname, omitBackground: transparent })
    await page.close()
    console.log(`書き出し: ${path}`)
  }
} finally {
  await browser.close()
}
