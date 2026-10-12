import { create } from 'zustand'
import { Course } from '../domain/course/Course.ts'
import type { RiderSettings } from '../domain/rider.ts'
import type { Devices } from '../devices/createDevices.ts'
import { saveFile, type SaveResult } from '../platform/fileSave.ts'
import { keepScreenOn, type WakeLockHandle } from '../platform/wakeLock.ts'
import { RideRecorder } from '../recording/RideRecorder.ts'
import type { RecordedRide } from '../recording/types.ts'
import { RideEngine, type RideSnapshot } from '../ride/RideEngine.ts'
import type { StoredRoute } from './db.ts'
import { saveRide } from './rideRepository.ts'

/** 走行記録の端末内保存の状態 */
export type RideSaveState = 'idle' | 'saving' | 'saved' | 'failed'

interface RideState {
  route: StoredRoute | null
  course: Course | null
  snapshot: RideSnapshot | null
  /** 終了後の走行記録。一度も走らずに終えた場合は null のまま */
  recordedRide: RecordedRide | null
  saveState: RideSaveState
}

const initialState: RideState = {
  route: null,
  course: null,
  snapshot: null,
  recordedRide: null,
  saveState: 'idle',
}

export const useRideStore = create<RideState>(() => initialState)

let engine: RideEngine | null = null
let wakeLock: WakeLockHandle | null = null
let unsubs: (() => void)[] = []

function cleanup() {
  for (const unsub of unsubs) unsub()
  unsubs = []
  engine?.dispose()
  engine = null
  wakeLock?.release()
  wakeLock = null
}

async function persist(ride: RecordedRide) {
  useRideStore.setState({ recordedRide: ride, saveState: 'saving' })
  try {
    await saveRide(ride)
    useRideStore.setState({ saveState: 'saved' })
  } catch (e) {
    console.error('走行記録を保存できませんでした', e)
    useRideStore.setState({ saveState: 'failed' })
  }
}

export const rideActions = {
  start(route: StoredRoute, devices: Devices, settings: RiderSettings) {
    cleanup()
    if (!devices.trainer) throw new Error('トレーナーがありません')
    const course = new Course(route.profile)
    const e = new RideEngine({
      course,
      trainer: devices.trainer,
      heartRate: devices.heartRate,
      settings,
    })
    engine = e
    // レコーダーは先に購読させ、終了の状態変化を記録し終えてから下で締める
    const recorder = new RideRecorder(e, {
      id: crypto.randomUUID(),
      routeId: route.id,
      routeName: route.name,
      settings,
    })
    unsubs.push(
      e.onSnapshot((snapshot) => {
        useRideStore.setState({ snapshot })
        if (snapshot.status !== 'finished') return
        wakeLock?.release()
        wakeLock = null
        const ride = recorder.finish()
        if (ride) void persist(ride)
      }),
    )
    useRideStore.setState({ ...initialState, route, course, snapshot: e.snapshot })
    wakeLock = keepScreenOn()
    e.start()
  },
  pause: () => engine?.pause(),
  resume: () => engine?.resume(),
  finish: () => engine?.finish(),
  exit() {
    cleanup()
    useRideStore.setState(initialState)
  },
  /** 走行記録を FIT ファイルとして書き出す（F4-2） */
  async exportFit(): Promise<SaveResult | null> {
    const ride = useRideStore.getState().recordedRide
    if (!ride) return null
    // FIT SDK は大きいので書き出すときだけ読み込む
    const { encodeRideFit, rideFitFileName } = await import('../recording/fitExport.ts')
    const bytes = encodeRideFit(ride, -new Date(ride.startedAtMs).getTimezoneOffset())
    return saveFile(rideFitFileName(ride), bytes, 'application/vnd.ant.fit', 'FIT')
  },
}
