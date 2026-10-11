import { XMLParser } from 'fast-xml-parser'

/** 1 件でも配列で返してほしいタグ */
const ARRAY_TAGS = new Set([
  'trk',
  'trkseg',
  'trkpt',
  'rte',
  'rtept',
  'Course',
  'Activity',
  'Lap',
  'Track',
  'Trackpoint',
])

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  parseTagValue: false,
  isArray: (tagName) => ARRAY_TAGS.has(tagName),
})

export type XmlNode = Record<string, unknown>

export function parseXml(text: string): XmlNode {
  return parser.parse(text) as XmlNode
}

export function child(node: unknown, name: string): XmlNode | undefined {
  if (!node || typeof node !== 'object') return undefined
  const v = (node as XmlNode)[name]
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as XmlNode) : undefined
}

export function children(node: unknown, name: string): XmlNode[] {
  if (!node || typeof node !== 'object') return []
  const v = (node as XmlNode)[name]
  if (Array.isArray(v)) return v.filter((x): x is XmlNode => !!x && typeof x === 'object')
  return v && typeof v === 'object' ? [v as XmlNode] : []
}

/** テキストノードの値。`<name>foo</name>` と属性付きの `{ '#text': 'foo' }` の両方に対応 */
export function text(node: unknown, name: string): string | undefined {
  if (!node || typeof node !== 'object') return undefined
  const v = (node as XmlNode)[name]
  if (typeof v === 'string') return v.trim() || undefined
  if (typeof v === 'number') return String(v)
  if (v && typeof v === 'object' && '#text' in v) return String((v as XmlNode)['#text']).trim()
  return undefined
}

export function num(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}
