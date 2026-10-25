import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BRAND_SVG_FILES } from './assets.ts'
import { badgeSvg, wordmarkSvg } from './logo.ts'

describe('logo', () => {
  it('自転車ありは人とランドナーを描き、なしは描かない', () => {
    expect(badgeSvg({ rider: true })).toContain('rotate(-4)')
    expect(badgeSvg()).not.toContain('rotate(-4)')
  })

  it('名前を付けると読み上げ、付けなければ装飾として隠す', () => {
    expect(badgeSvg({ label: 'Lacets' })).toContain('aria-label="Lacets"')
    expect(badgeSvg()).toContain('aria-hidden="true"')
  })

  it('小さく使うロゴ文字は中央線を消す', () => {
    expect(wordmarkSvg()).toContain('stroke-dasharray')
    expect(wordmarkSvg({ centerLine: false })).not.toContain('stroke-dasharray')
  })

  it.each(Object.entries(BRAND_SVG_FILES))(
    '%s がロゴの定義と一致する（違えば npm run brand で作り直す）',
    (path, svg) => {
      const file = readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8')
      expect(file).toBe(svg + '\n')
    },
  )
})
