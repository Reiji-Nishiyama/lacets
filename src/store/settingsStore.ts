import { create } from 'zustand'
import { DEFAULT_RIDER_SETTINGS, type RiderSettings } from '../domain/rider.ts'
import { DEFAULT_MEDIA_SETTINGS, type MediaSettings } from '../media/mediaSettings.ts'
import {
  loadMediaSettings,
  loadRiderSettings,
  saveMediaSettings,
  saveRiderSettings,
} from './settingsRepository.ts'

interface SettingsState {
  rider: RiderSettings
  media: MediaSettings
  loaded: boolean
}

export const useSettingsStore = create<SettingsState>(() => ({
  rider: DEFAULT_RIDER_SETTINGS,
  media: DEFAULT_MEDIA_SETTINGS,
  loaded: false,
}))

export async function loadSettings(): Promise<void> {
  try {
    const [rider, media] = await Promise.all([loadRiderSettings(), loadMediaSettings()])
    useSettingsStore.setState({ rider, media, loaded: true })
  } catch (e) {
    console.warn('設定を読み込めませんでした。既定値を使います', e)
    useSettingsStore.setState({ loaded: true })
  }
}

export function updateRiderSettings(patch: Partial<RiderSettings>): void {
  const rider = { ...useSettingsStore.getState().rider, ...patch }
  useSettingsStore.setState({ rider })
  saveRiderSettings(rider).catch((e: unknown) => console.warn('設定を保存できませんでした', e))
}

export function updateMediaSettings(patch: Partial<MediaSettings>): void {
  const media = { ...useSettingsStore.getState().media, ...patch }
  useSettingsStore.setState({ media })
  saveMediaSettings(media).catch((e: unknown) => console.warn('設定を保存できませんでした', e))
}
