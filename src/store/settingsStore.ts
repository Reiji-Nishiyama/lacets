import { create } from 'zustand'
import { DEFAULT_RIDER_SETTINGS, type RiderSettings } from '../domain/rider.ts'
import { DEFAULT_MEDIA_SETTINGS, type MediaSettings } from '../media/mediaSettings.ts'
import {
  DEFAULT_TRAINER_SETTINGS,
  loadMediaSettings,
  loadRiderSettings,
  loadTrainerSettings,
  saveMediaSettings,
  saveRiderSettings,
  saveTrainerSettings,
  type TrainerSettings,
} from './settingsRepository.ts'

interface SettingsState {
  rider: RiderSettings
  media: MediaSettings
  trainer: TrainerSettings
  loaded: boolean
}

export const useSettingsStore = create<SettingsState>(() => ({
  rider: DEFAULT_RIDER_SETTINGS,
  media: DEFAULT_MEDIA_SETTINGS,
  trainer: DEFAULT_TRAINER_SETTINGS,
  loaded: false,
}))

export async function loadSettings(): Promise<void> {
  try {
    const [rider, media, trainer] = await Promise.all([
      loadRiderSettings(),
      loadMediaSettings(),
      loadTrainerSettings(),
    ])
    useSettingsStore.setState({ rider, media, trainer, loaded: true })
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

export function updateTrainerSettings(patch: Partial<TrainerSettings>): void {
  const trainer = { ...useSettingsStore.getState().trainer, ...patch }
  useSettingsStore.setState({ trainer })
  saveTrainerSettings(trainer).catch((e: unknown) => console.warn('設定を保存できませんでした', e))
}

/** 実際の総重量 ÷ トレーナーの想定総重量（補正しないなら 1） */
export function trainerMassRatio(rider: RiderSettings, trainer: TrainerSettings): number {
  if (!trainer.assumedMassKg || trainer.assumedMassKg <= 0) return 1
  return (rider.riderMassKg + rider.bikeMassKg) / trainer.assumedMassKg
}
