import { ja, type MessageKey } from './ja.ts'

export type { MessageKey }

/**
 * UI 文言を取得する。現状は日本語のみだが、i18n 前提で文字列を直書きせずこの関数を経由させる。
 * 文言中の `{name}` は params の値で置換する。
 */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const message: string = ja[key]
  if (!params) return message
  return message.replace(/\{(\w+)\}/g, (m, name: string) =>
    name in params ? String(params[name]) : m,
  )
}
