import { badgeSvg, wordmarkSvg, type BadgeOptions, type WordmarkOptions } from './logo.ts'

/**
 * ロゴの部品。SVG の形は logo.ts の固定の文字列（利用者の入力を含まない）なので、
 * そのまま差し込む
 */
export function LogoBadge({ className, ...options }: BadgeOptions & { className?: string }) {
  return (
    <span
      className={className ?? 'logo-badge'}
      dangerouslySetInnerHTML={{ __html: badgeSvg(options) }}
    />
  )
}

export function LogoWordmark({ className, ...options }: WordmarkOptions & { className?: string }) {
  return (
    <span
      className={className ?? 'logo-wordmark'}
      dangerouslySetInnerHTML={{ __html: wordmarkSvg(options) }}
    />
  )
}
