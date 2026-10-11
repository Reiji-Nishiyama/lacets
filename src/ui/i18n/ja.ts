/** 日本語の UI 文言。キーは英語、値は表示文字列。 */
export const ja = {
  'app.name': 'Lacets',
  'app.tagline': '実在のルートを、室内で。',
} as const

export type MessageKey = keyof typeof ja
