import { badgeSvg, wordmarkSvg } from './logo.ts'

/** リポジトリに置くロゴの SVG（scripts/generate-brand-assets.ts が書き出す） */
export const BRAND_SVG_FILES: Record<string, string> = {
  'public/favicon.svg': badgeSvg({ label: 'Lacets' }),
  'public/icon.svg': badgeSvg({ label: 'Lacets' }),
  'docs/brand/lacets-badge.svg': badgeSvg({ label: 'Lacets' }),
  'docs/brand/lacets-badge-rider.svg': badgeSvg({ rider: true, label: 'Lacets' }),
  'docs/brand/lacets-wordmark.svg': wordmarkSvg({ label: 'Lacets' }),
  'docs/brand/lacets-wordmark-dark.svg': wordmarkSvg({ tone: 'dark', label: 'Lacets' }),
}
