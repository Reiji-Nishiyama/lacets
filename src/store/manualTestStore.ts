import { create } from 'zustand'
import { DEFAULT_CDA_M2, DEFAULT_CRR } from '../domain/physics/aero.ts'
import { saveFile } from '../platform/fileSave.ts'
import {
  diagnosticsFileName,
  manualTestCsv,
  type ManualTestSample,
} from '../recording/diagnosticsCsv.ts'
import { useDeviceStore } from './deviceStore.ts'

/**
 * デバイス画面の勾配テストの記録（#7）。勾配スライダーの値と、トレーナーのパワー・ケイデンス・
 * 速度を 1 秒ごとに残し、CSV で書き出す。走行（RideEngine）とは独立に動く
 */
interface ManualTestState {
  recording: boolean
  samples: ManualTestSample[]
}

export const useManualTestStore = create<ManualTestState>(() => ({ recording: false, samples: [] }))

const STALE_MS = 2000
let stop: (() => void) | null = null

export const manualTestActions = {
  start() {
    if (stop) return
    const { trainer, heartRate } = useDeviceStore.getState().devices
    if (!trainer) return
    let latest: {
      powerW: number
      cadenceRpm?: number
      trainerSpeedMps?: number
      at: number
    } | null = null
    let hr: { bpm: number; at: number } | null = null
    const unsubs = [
      trainer.onData((d) => {
        latest = { ...d, at: d.timestampMs }
      }),
      ...(heartRate
        ? [heartRate.onData((d) => (hr = { bpm: d.heartRateBpm, at: d.timestampMs }))]
        : []),
    ]
    const timer = setInterval(() => {
      const now = Date.now()
      const fresh = latest && now - latest.at < STALE_MS ? latest : null
      const freshHr = hr && now - hr.at < STALE_MS * 2 ? hr : null
      const sample: ManualTestSample = {
        timestampMs: now,
        grade: useDeviceStore.getState().manualGrade,
        powerW: fresh?.powerW ?? null,
        cadenceRpm: fresh?.cadenceRpm ?? null,
        heartRateBpm: freshHr?.bpm ?? null,
        trainerSpeedMps: fresh?.trainerSpeedMps ?? null,
      }
      useManualTestStore.setState((s) => ({ samples: [...s.samples, sample] }))
    }, 1000)
    stop = () => {
      clearInterval(timer)
      for (const u of unsubs) u()
    }
    useManualTestStore.setState({ recording: true, samples: [] })
  },
  stop() {
    stop?.()
    stop = null
    useManualTestStore.setState({ recording: false })
  },
  async exportCsv() {
    const { samples } = useManualTestStore.getState()
    if (samples.length === 0) return
    const trainerName = useDeviceStore.getState().trainerName
    // 勾配スライダー（GradeControl）が送っている Crr・CdA と同じ既定値
    const csv = manualTestCsv(samples, {
      crr: DEFAULT_CRR,
      cdaM2: DEFAULT_CDA_M2,
      ...(trainerName ? { trainerName } : {}),
    })
    return saveFile(
      diagnosticsFileName('grade-test', samples[0]!.timestampMs),
      new TextEncoder().encode(csv),
      'text/csv',
      'CSV',
    )
  },
}
