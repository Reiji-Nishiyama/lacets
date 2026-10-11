import { ja, type MessageKey } from './ja.ts'

export type { MessageKey }

/**
 * UI 文言を取得する。現状は日本語のみだが、i18n 前提で文字列を直書きせずこの関数を経由させる。
 */
export function t(key: MessageKey): string {
  return ja[key]
}
