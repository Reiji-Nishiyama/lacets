/**
 * Lacets のロゴ（docs/07-design.md「ロゴ」）。形はここにだけ書き、画面の部品・ファビコン・
 * PWA アイコン（scripts/generate-brand-assets.ts で public/ に書き出す）で共有する。
 *
 * - バッジ: 円の中に山と太陽、山肌を登るつづら折りの白い道。rider ありはふもとをランドナーで走る人
 * - ロゴ文字: 筆記体の「Lacets」を 1 本の峠道として描く（緑の道に白い破線の中央線）
 *
 * 自転車は 32 px 以下では読めないので、ファビコン・タブ・小さなアイコンは自転車なし、
 * 起動画面や README など大きく見せる場面で自転車ありを使う。
 */

const SKY = '#CDE8F3'
const FAR = '#A9D3E3'
const MEADOW = '#8CC3B0'
const PINE = '#2C5F4F'
const INK = '#24343B'
const SUN = '#F4B63C'
const WHITE = '#FFFFFF'
const PAPER_SKY = '#E3F1F8'

/** バッジの風景（200×200）。円で切り抜く前の全面の絵 */
function badgeScene(rider: boolean): string {
  return [
    `<rect width="200" height="200" fill="${SKY}"/>`,
    `<circle cx="146" cy="56" r="18" fill="${SUN}"/>`,
    `<path d="M0 132 L52 92 L88 116 L140 74 L200 122 L200 200 L0 200 Z" fill="${FAR}"/>`,
    `<path d="M-20 210 L100 62 L220 210 Z" fill="${MEADOW}" stroke="${MEADOW}" stroke-width="16" stroke-linejoin="round"/>`,
    `<polyline points="0,172 160,160 86,138 130,120 96,103 108,90 100,78" fill="none" stroke="${WHITE}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`,
    rider ? `<g transform="translate(31.4,127) rotate(-4) scale(0.5)">${randonneur(INK)}</g>` : '',
  ].join('')
}

/**
 * ランドナーに乗る人（横向き、100×80 ほど）。泥除け・フロントバッグ・ドロップハンドル・
 * ホリゾンタルのフレーム・リアキャリア、人はサイクルキャップ
 */
function randonneur(color: string): string {
  const line = (d: string, width = 2.6) =>
    `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`
  return [
    `<circle cx="20" cy="60" r="16" fill="none" stroke="${color}" stroke-width="2.6"/>`,
    `<circle cx="82" cy="60" r="16" fill="none" stroke="${color}" stroke-width="2.6"/>`,
    line('M1 62 A19.5 19.5 0 0 1 34 46'),
    line('M68 46 A19.5 19.5 0 0 1 101 62'),
    line('M20 60 L45 60 L39 31 Z'),
    line('M39 31 L72 31 L45 60'),
    line('M72 31 L74 38 Q77 54 82 60'),
    line('M78 24 L92 24 L87 42'),
    line('M72 31 L73 25 L79 25 Q85 25 84 31 Q83 35 79 34'),
    line('M36 35 L12 35 M16 35 L22 50'),
    line('M45 60 L49 67'),
    line('M38 27 L52 41 L49 67', 4.2),
    line('M38 27 L57 11', 5.5),
    line('M57 11 L68 19 L79 25', 3.4),
    `<rect x="79" y="14" width="15" height="10" rx="2.5" fill="${color}"/>`,
    `<path d="M33 30 Q38 27 44 29 L42 31 Z" fill="${color}"/>`,
    `<circle cx="61" cy="3" r="6" fill="${color}"/>`,
    line('M56 -1 Q61 -6 66 -2 L71 -1', 2.4),
  ].join('')
}

export interface BadgeOptions {
  /** ランドナーに乗る人を描く */
  rider?: boolean
  /** 表示の大きさ（省略時は width/height なし = 親に合わせる） */
  size?: number
  /** 読み上げる名前。省略すると装飾として読み上げない */
  label?: string
}

function sizeAttrs(width?: number, height?: number): string {
  return width === undefined ? '' : ` width="${width}" height="${height ?? width}"`
}

function a11yAttrs(label?: string): string {
  return label ? ` role="img" aria-label="${label}"` : ' aria-hidden="true"'
}

/** 丸いバッジ（ファビコン・ヘッダー・PWA の any アイコン） */
export function badgeSvg({ rider = false, size, label }: BadgeOptions = {}): string {
  const id = rider ? 'lacets-badge-clip-rider' : 'lacets-badge-clip'
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"${sizeAttrs(size)}${a11yAttrs(label)}>` +
    `<defs><clipPath id="${id}"><circle cx="100" cy="100" r="96"/></clipPath></defs>` +
    `<g clip-path="url(#${id})">${badgeScene(rider)}</g></svg>`
  )
}

/**
 * 四角いアイコン（PWA の maskable、iOS のホーム画面）。端末が角や円で切り抜くので、
 * 円で切り抜かずに風景を全面に描く
 */
export function squareIconSvg({ rider = false, size, label }: BadgeOptions = {}): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"${sizeAttrs(size)}${a11yAttrs(label)}>` +
    `${badgeScene(rider)}</svg>`
  )
}

/** 筆記体の「Lacets」の道の中心線（viewBox 0 20 400 160） */
export const WORDMARK_PATH =
  'M14 150 C40 150 62 120 72 80 C80 45 102 30 106 48 C110 66 82 90 72 120 C66 140 52 158 40 150 ' +
  'C30 142 52 136 76 142 C98 148 112 150 126 140 C134 118 156 98 166 104 C162 98 136 100 134 126 ' +
  'C132 150 158 150 166 120 C164 130 166 152 184 146 C194 140 204 108 220 104 C230 102 230 114 220 112 ' +
  'C206 110 198 118 198 130 C198 152 222 152 238 140 C256 130 272 118 270 106 C268 96 248 100 248 124 ' +
  'C248 150 276 152 290 138 C302 120 312 90 318 60 C314 90 306 130 318 148 C326 156 340 146 348 136 ' +
  'C358 120 366 104 372 100 C386 112 394 130 380 146 C370 154 356 150 354 144 M300 98 L342 92'

export type WordmarkTone = 'light' | 'dark'

export interface WordmarkOptions {
  /** light = 明るい地（緑の道・白い縁と中央線）、dark = 濃い地（空色の道・緑の中央線） */
  tone?: WordmarkTone
  /** 白い破線の中央線。小さく使うときは消す */
  centerLine?: boolean
  /** 表示の高さ（幅は 2.5 倍） */
  height?: number
  label?: string
}

export function wordmarkSvg({
  tone = 'light',
  centerLine = true,
  height,
  label,
}: WordmarkOptions = {}): string {
  const [casing, road, lane] = tone === 'light' ? [WHITE, PINE, WHITE] : [PINE, PAPER_SKY, PINE]
  const stroke = (color: string, width: number, extra = '') =>
    `<path d="${WORDMARK_PATH}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 20 400 160"` +
    `${height === undefined ? '' : ` width="${height * 2.5}" height="${height}"`}${a11yAttrs(label)}>` +
    (centerLine ? stroke(casing, 20) : '') +
    stroke(road, 13) +
    (centerLine ? stroke(lane, 1.6, ' stroke-dasharray="5 5"') : '') +
    `</svg>`
  )
}
