export type RouteParseErrorCode = 'unsupportedFormat' | 'invalidFile' | 'noPoints'

/** ルートファイルを解釈できなかったことを示す。code は UI の文言選択に使う */
export class RouteParseError extends Error {
  override name = 'RouteParseError'
  readonly code: RouteParseErrorCode

  constructor(code: RouteParseErrorCode, message: string) {
    super(message)
    this.code = code
  }
}
