import { describe, expect, it, vi } from 'vitest'
import { northboundRoute } from '../../test/helpers/syntheticRoute.ts'
import { buildProfile } from '../domain/course/profile.ts'
import type { StreetImage } from '../domain/media/streetImages.ts'
import { MapillaryAuthError } from '../integrations/mapillary/mapillary.ts'
import { DEFAULT_MEDIA_SETTINGS } from './mediaSettings.ts'
import { searchersFor, searchStreetImages } from './streetImageSearch.ts'

const { profile } = buildProfile(
  northboundRoute(2000, 10, () => 0),
  'dem',
)

const img = (provider: StreetImage['provider'], id: string): StreetImage => ({
  provider,
  id,
  lat: 45,
  lon: 6,
  azimuthDeg: 0,
  isPano: false,
  capturedAtMs: null,
  imageUrl: 'x',
  thumbUrl: 'x',
  creator: null,
  license: null,
})

describe('searchersFor', () => {
  it('Panoramax は既定で有効、Mapillary はトークンがあるときだけ', () => {
    expect(Object.keys(searchersFor(DEFAULT_MEDIA_SETTINGS))).toEqual(['panoramax'])
    expect(
      Object.keys(searchersFor({ ...DEFAULT_MEDIA_SETTINGS, mapillaryToken: ' MLY|x ' })),
    ).toEqual(['panoramax', 'mapillary'])
    expect(
      Object.keys(searchersFor({ ...DEFAULT_MEDIA_SETTINGS, panoramaxEnabled: false })),
    ).toEqual([])
  })
})

describe('searchStreetImages', () => {
  it('ルート沿いのマス目をすべて検索し、重複を除く', async () => {
    const panoramax = vi.fn(async () => [img('panoramax', 'a'), img('panoramax', 'b')])
    const result = await searchStreetImages(profile, { panoramax })
    expect(panoramax.mock.calls.length).toBeGreaterThanOrEqual(4) // 2 km 北上 ≈ 0.018 度
    expect(result.images.map((i) => i.id).sort()).toEqual(['a', 'b'])
    expect(result.errors).toEqual([])
  })

  it('一部の失敗はエラーに数えて続ける。認証エラーはそのプロバイダーを打ち切る', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    let n = 0
    const panoramax = vi.fn(async () => {
      if (n++ === 0) throw new Error('timeout')
      return [img('panoramax', `p${n}`)]
    })
    const mapillary = vi.fn(async () => {
      throw new MapillaryAuthError('bad token')
    })
    const result = await searchStreetImages(profile, { panoramax, mapillary }, { concurrency: 1 })
    expect(result.images.length).toBeGreaterThan(0)
    expect(result.errors).toEqual([
      { provider: 'panoramax', kind: 'network', message: expect.stringMatching(/^1 \//) },
      { provider: 'mapillary', kind: 'auth', message: 'bad token' },
    ])
    expect(mapillary).toHaveBeenCalledTimes(1)
  })
})
