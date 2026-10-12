import type { ParsedRoute } from '../types.ts'
import { parseFit } from './fit.ts'
import { parseGpx } from './gpx.ts'
import { RouteParseError } from './RouteParseError.ts'
import { parseTcx } from './tcx.ts'

export { RouteParseError, type RouteParseErrorCode } from './RouteParseError.ts'

/** FIT ヘッダの 8〜11 バイト目は ".FIT" */
function looksLikeFit(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 12 &&
    bytes[8] === 0x2e &&
    bytes[9] === 0x46 &&
    bytes[10] === 0x49 &&
    bytes[11] === 0x54
  )
}

/**
 * ルートファイル（GPX / TCX / FIT）を解釈する。形式は拡張子ではなく中身で判定する。
 */
export function parseRouteFile(bytes: Uint8Array): ParsedRoute {
  if (looksLikeFit(bytes)) return parseFit(bytes)
  const head = new TextDecoder().decode(bytes.subarray(0, 4096))
  const xml = () => new TextDecoder().decode(bytes)
  if (/<gpx[\s>]/.test(head)) return parseGpx(xml())
  if (/<TrainingCenterDatabase[\s>]/.test(head)) return parseTcx(xml())
  throw new RouteParseError('unsupportedFormat', 'GPX / TCX / FIT のいずれでもありません')
}
