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

type SettingsKind = 'rider' | 'media' | 'trainer'

/**
 * 設定の保存を種類ごとに 1 列に並べる。保存は実行する時点の最新の設定を書くので、
 * 素早く続けて変更しても、最後に残るのは必ず画面と同じ内容になる
 * （投げっぱなしの保存は終わる順番が入れ替わり、古い内容が最後に書かれることがあった）
 */
const saveChains: Record<SettingsKind, Promise<void>> = {
  rider: Promise.resolve(),
  media: Promise.resolve(),
  trainer: Promise.resolve(),
}

/** 起動時の読み込みが終わる前に変更された種類（読み込み結果で上書きしない） */
const changedBeforeLoad = new Set<SettingsKind>()

function saveLatest(kind: SettingsKind): Promise<void> {
  const state = useSettingsStore.getState()
  switch (kind) {
    case 'rider':
      return saveRiderSettings(state.rider)
    case 'media':
      return saveMediaSettings(state.media)
    case 'trainer':
      return saveTrainerSettings(state.trainer)
  }
}

function persist(kind: SettingsKind): void {
  if (!useSettingsStore.getState().loaded) changedBeforeLoad.add(kind)
  saveChains[kind] = saveChains[kind]
    .then(() => saveLatest(kind))
    .catch((e: unknown) => console.warn('設定を保存できませんでした', e))
}

/** 保存待ちがすべて終わるまで待つ（テスト用） */
export function settingsSaved(): Promise<void> {
  return Promise.all(Object.values(saveChains)).then(() => undefined)
}

export async function loadSettings(): Promise<void> {
  try {
    const [rider, media, trainer] = await Promise.all([
      loadRiderSettings(),
      loadMediaSettings(),
      loadTrainerSettings(),
    ])
    const loaded = { rider, media, trainer }
    const patch: Partial<SettingsState> = { loaded: true }
    for (const kind of ['rider', 'media', 'trainer'] as const) {
      if (!changedBeforeLoad.has(kind)) Object.assign(patch, { [kind]: loaded[kind] })
    }
    useSettingsStore.setState(patch)
  } catch (e) {
    console.warn('設定を読み込めませんでした。既定値を使います', e)
    useSettingsStore.setState({ loaded: true })
  }
}

export function updateRiderSettings(patch: Partial<RiderSettings>): void {
  useSettingsStore.setState((s) => ({ rider: { ...s.rider, ...patch } }))
  persist('rider')
}

export function updateMediaSettings(patch: Partial<MediaSettings>): void {
  useSettingsStore.setState((s) => ({ media: { ...s.media, ...patch } }))
  persist('media')
}

export function updateTrainerSettings(patch: Partial<TrainerSettings>): void {
  useSettingsStore.setState((s) => ({ trainer: { ...s.trainer, ...patch } }))
  persist('trainer')
}

/** 実際の総重量 ÷ トレーナーの想定総重量（補正しないなら 1） */
export function trainerMassRatio(rider: RiderSettings, trainer: TrainerSettings): number {
  if (!trainer.assumedMassKg || trainer.assumedMassKg <= 0) return 1
  return (rider.riderMassKg + rider.bikeMassKg) / trainer.assumedMassKg
}
