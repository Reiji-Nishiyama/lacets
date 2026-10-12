import { create } from 'zustand'
import { DEFAULT_RIDER_SETTINGS, type RiderSettings } from '../domain/rider.ts'
import { loadRiderSettings, saveRiderSettings } from './settingsRepository.ts'

interface SettingsState {
  rider: RiderSettings
  loaded: boolean
}

export const useSettingsStore = create<SettingsState>(() => ({
  rider: DEFAULT_RIDER_SETTINGS,
  loaded: false,
}))

export async function loadSettings(): Promise<void> {
  try {
    useSettingsStore.setState({ rider: await loadRiderSettings(), loaded: true })
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
