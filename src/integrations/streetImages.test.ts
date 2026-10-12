import { describe, expect, it, vi } from 'vitest'
import { readFixture } from '../../test/helpers/fixtures.ts'
import { MapillaryAuthError, parseMapillaryImages, searchMapillary } from './mapillary/mapillary.ts'
import { parsePanoramaxSearch, searchPanoramax } from './panoramax/panoramax.ts'

const json = (name: string) =>
  JSON.parse(new TextDecoder().decode(readFixture(`street-images/${name}`))) as unknown

describe('Panoramax', () => {
  it('STAC の検索結果を共通の形にする', () => {
    const images = parsePanoramaxSearch(json('panoramax-search.json'))
    expect(images).toHaveLength(2)
    expect(images[0]).toEqual({
      provider: 'panoramax',
      id: 'pano-1',
      lat: 45.001,
      lon: 6,
      azimuthDeg: 10,
      isPano: true,
      capturedAtMs: Date.parse('2024-07-01T10:00:00Z'),
      imageUrl: 'https://example.org/pano-1/sd.jpg',
      thumbUrl: 'https://example.org/pano-1/thumb.jpg',
      creator: 'Rider A',
      license: 'CC-BY-SA-4.0',
    })
    // sd がなければ hd、providers がなければ geovisio:producer
    expect(images[1]).toMatchObject({
      isPano: false,
      imageUrl: 'https://example.org/flat-1/hd.jpg',
      creator: 'Rider B',
      license: 'etalab-2.0',
    })
    expect(parsePanoramaxSearch({})).toEqual([])
  })

  it('bbox で検索する', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify(json('panoramax-search.json'))))
    const images = await searchPanoramax([6, 45, 6.005, 45.005], { fetchFn, limit: 50 })
    expect(images).toHaveLength(2)
    expect(fetchFn).toHaveBeenCalledWith(
      'https://api.panoramax.xyz/api/search?bbox=6,45,6.005,45.005&limit=50',
      expect.anything(),
    )
  })
})

describe('Mapillary', () => {
  it('/images の結果を共通の形にする（補正後の位置・方位を優先）', () => {
    const images = parseMapillaryImages(json('mapillary-images.json'))
    expect(images).toHaveLength(2)
    expect(images[0]).toEqual({
      provider: 'mapillary',
      id: '1001',
      lat: 45.003,
      lon: 6,
      azimuthDeg: 3.5,
      isPano: false,
      capturedAtMs: 1690000000000,
      imageUrl: 'https://example.org/m/1001-2048.jpg',
      thumbUrl: 'https://example.org/m/1001-1024.jpg',
      creator: 'mapper',
      license: 'CC-BY-SA-4.0',
    })
    expect(images[1]).toMatchObject({ isPano: true, azimuthDeg: 180, creator: null })
  })

  it('トークンはヘッダで送り、認証エラーは MapillaryAuthError', async () => {
    const ok = vi.fn(async () => new Response(JSON.stringify(json('mapillary-images.json'))))
    await searchMapillary([6, 45, 6.005, 45.005], 'MLY|token', { fetchFn: ok })
    const [url, init] = ok.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).not.toContain('token')
    expect(url).toContain('bbox=6%2C45%2C6.005%2C45.005')
    expect(init.headers).toEqual({ Authorization: 'OAuth MLY|token' })

    const denied = vi.fn(async () => new Response('{}', { status: 401 }))
    await expect(
      searchMapillary([6, 45, 6.005, 45.005], 'bad', { fetchFn: denied }),
    ).rejects.toBeInstanceOf(MapillaryAuthError)
  })
})
