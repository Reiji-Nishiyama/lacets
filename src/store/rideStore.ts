import { create } from 'zustand'
import { Course } from '../domain/course/Course.ts'
import { GhostComparator, type GhostState } from '../domain/ghost/GhostComparator.ts'
import type { RiderSettings } from '../domain/rider.ts'
import type { Devices } from '../devices/createDevices.ts'
import { saveFile, type SaveResult } from '../platform/fileSave.ts'
import { keepScreenOn, type WakeLockHandle } from '../platform/wakeLock.ts'
import { RideRecorder } from '../recording/RideRecorder.ts'
import type { RecordedRide } from '../recording/types.ts'
import { RideEngine, type RideSnapshot } from '../ride/RideEngine.ts'
import type { LoadedGhost } from './ghosts.ts'
import type { RouteVariant } from './routeVariant.ts'
import { saveRide } from './rideRepository.ts'

/** 走行記録の端末内保存の状態 */
export type RideSaveState = 'idle' | 'saving' | 'saved' | 'failed'

interface RideState {
  route: RouteVariant | null
  course: Course | null
  snapshot: RideSnapshot | null
  /** 走行中に比べているゴースト */
  ghost: LoadedGhost | null
  ghostState: GhostState | null
  /** 終了後の走行記録。一度も走らずに終えた場合は null のまま */
  recordedRide: RecordedRide | null
  saveState: RideSaveState
}

const initialState: RideState = {
  route: null,
  course: null,
  snapshot: null,
  ghost: null,
  ghostState: null,
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
  start(
    route: RouteVariant,
    devices: Devices,
    settings: RiderSettings,
    ghost: LoadedGhost | null = null,
    /** 走り始めるルート上の距離（#5） */
    startDistanceM = 0,
  ) {
    cleanup()
    if (!devices.trainer) throw new Error('トレーナーがありません')
    const course = new Course(route.profile)
    const e = new RideEngine({
      course,
      trainer: devices.trainer,
      heartRate: devices.heartRate,
      settings,
      startDistanceM,
    })
    engine = e
    // レコーダーは先に購読させ、終了の状態変化を記録し終えてから下で締める
    const recorder = new RideRecorder(e, {
      id: crypto.randomUUID(),
      routeId: route.id,
      routeName: route.name,
      settings,
      ...(ghost ? { ghost: { ...ghost.ref, name: ghost.name } } : {}),
      ...(route.reversed ? { reversed: true } : {}),
      ...(e.snapshot.distanceM > 0 ? { startDistanceM: e.snapshot.distanceM } : {}),
    })
    const comparator = ghost ? new GhostComparator(ghost.track) : null
    unsubs.push(
      e.onSnapshot((snapshot) => {
        const ghostState = comparator?.update(snapshot.distanceM, snapshot.elapsedS) ?? null
        useRideStore.setState({ snapshot, ghostState })
        if (snapshot.status !== 'finished') return
        wakeLock?.release()
        wakeLock = null
        const ride = recorder.finish()
        if (ride) void persist(ride)
      }),
    )
    useRideStore.setState({ ...initialState, route, course, ghost, snapshot: e.snapshot })
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
}

/** 走行記録を FIT ファイルとして書き出す（F4-2） */
export async function exportRideFit(ride: RecordedRide): Promise<SaveResult> {
  // FIT SDK は大きいので書き出すときだけ読み込む
  const { encodeRideFit, rideFitFileName } = await import('../recording/fitExport.ts')
  const bytes = encodeRideFit(ride, -new Date(ride.startedAtMs).getTimezoneOffset())
  return saveFile(rideFitFileName(ride), bytes, 'application/vnd.ant.fit', 'FIT')
}
