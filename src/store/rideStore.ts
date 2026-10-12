import { create } from 'zustand'
import { Course } from '../domain/course/Course.ts'
import type { RiderSettings } from '../domain/rider.ts'
import type { Devices } from '../devices/createDevices.ts'
import { keepScreenOn, type WakeLockHandle } from '../platform/wakeLock.ts'
import { RideEngine, type RideSnapshot } from '../ride/RideEngine.ts'
import type { StoredRoute } from './db.ts'

export interface RideSummary {
  elapsedS: number
  distanceM: number
  averagePowerW: number
}

interface RideState {
  route: StoredRoute | null
  course: Course | null
  snapshot: RideSnapshot | null
  summary: RideSummary | null
}

export const useRideStore = create<RideState>(() => ({
  route: null,
  course: null,
  snapshot: null,
  summary: null,
}))

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
    // 平均パワーは記録ティック（約 1 秒ごと）の仕事量から求める
    let workJ = 0
    let timeS = 0
    unsubs.push(
      e.onRecordTick(({ snapshot, dtS }) => {
        workJ += snapshot.powerW * dtS
        timeS += dtS
      }),
      e.onSnapshot((snapshot) => {
        const summary: RideSummary | null =
          snapshot.status === 'finished'
            ? {
                elapsedS: snapshot.elapsedS,
                distanceM: snapshot.distanceM,
                averagePowerW: timeS > 0 ? workJ / timeS : 0,
              }
            : null
        useRideStore.setState({ snapshot, summary })
        if (snapshot.status === 'finished') {
          wakeLock?.release()
          wakeLock = null
        }
      }),
    )
    useRideStore.setState({ route, course, snapshot: e.snapshot, summary: null })
    wakeLock = keepScreenOn()
    e.start()
  },
  pause: () => engine?.pause(),
  resume: () => engine?.resume(),
  finish: () => engine?.finish(),
  exit() {
    cleanup()
    useRideStore.setState({ route: null, course: null, snapshot: null, summary: null })
  },
}
