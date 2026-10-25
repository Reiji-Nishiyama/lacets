import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_MEDIA_SETTINGS, type MediaSettings } from '../media/mediaSettings.ts'

// 保存・読み込みを差し替え、保存の終わる順番を入れ替えられるようにする
const saved: MediaSettings[] = []
let inFlight = 0
let maxInFlight = 0
let loadResolve: ((v: MediaSettings) => void) | null = null

vi.mock('./settingsRepository.ts', async (orig) => {
  const actual = await orig<typeof import('./settingsRepository.ts')>()
  return {
    ...actual,
    loadRiderSettings: async () => (await import('../domain/rider.ts')).DEFAULT_RIDER_SETTINGS,
    loadTrainerSettings: async () => actual.DEFAULT_TRAINER_SETTINGS,
    loadMediaSettings: () =>
      new Promise<MediaSettings>((resolve) => {
        loadResolve = resolve
      }),
    saveRiderSettings: async () => {},
    saveTrainerSettings: async () => {},
    // 1 回目の保存はわざと遅くする（投げっぱなしなら 2 回目が先に終わり、古い内容が最後に残る）
    saveMediaSettings: async (m: MediaSettings) => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((r) => setTimeout(r, saved.length === 0 ? 30 : 1))
      saved.push(m)
      inFlight--
    },
  }
})

beforeEach(() => {
  vi.resetModules()
  saved.length = 0
  inFlight = 0
  maxInFlight = 0
  loadResolve = null
})

describe('settingsStore の保存', () => {
  it('続けて変更しても保存は 1 列に並び、最後に残るのは最新の内容', async () => {
    const store = await import('./settingsStore.ts')
    store.useSettingsStore.setState({ loaded: true })
    store.updateMediaSettings({ mapillaryToken: 'MLY|test' })
    store.updateMediaSettings({ panoramaxEnabled: false })
    await store.settingsSaved()
    expect(maxInFlight).toBe(1)
    expect(saved.at(-1)).toEqual({
      ...DEFAULT_MEDIA_SETTINGS,
      mapillaryToken: 'MLY|test',
      panoramaxEnabled: false,
    })
  })

  it('起動時の読み込みより先に変更した設定は、読み込み結果で上書きしない', async () => {
    const store = await import('./settingsStore.ts')
    const loading = store.loadSettings()
    store.updateMediaSettings({ panoramaxEnabled: false })
    loadResolve!({ ...DEFAULT_MEDIA_SETTINGS, mapillaryToken: 'old' })
    await loading
    expect(store.useSettingsStore.getState().media.panoramaxEnabled).toBe(false)
    expect(store.useSettingsStore.getState().loaded).toBe(true)
  })
})
