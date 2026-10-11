import { create } from 'zustand'
import type { ConnectionState } from '../devices/ConnectionState.ts'
import type { Devices } from '../devices/createDevices.ts'
import type { TrainerCapabilities, TrainerData } from '../devices/TrainerDevice.ts'

export type DeviceError =
  { kind: 'connectFailed'; detail: string } | { kind: 'commandFailed'; detail: string }

export interface DeviceStoreState {
  devices: Devices
  trainerState: ConnectionState
  trainerName: string | undefined
  capabilities: TrainerCapabilities | null
  trainerData: TrainerData | null
  heartRateState: ConnectionState
  heartRateName: string | undefined
  heartRateBpm: number | null
  error: DeviceError | null
}

const initialState: DeviceStoreState = {
  devices: { trainer: null, heartRate: null },
  trainerState: 'disconnected',
  trainerName: undefined,
  capabilities: null,
  trainerData: null,
  heartRateState: 'disconnected',
  heartRateName: undefined,
  heartRateBpm: null,
  error: null,
}

export const useDeviceStore = create<DeviceStoreState>(() => initialState)

/** デバイスのイベントをストアに結び付ける。戻り値で解除する。 */
export function bindDevices(devices: Devices): () => void {
  const { trainer, heartRate } = devices
  useDeviceStore.setState({ ...initialState, devices })
  const unsubs: (() => void)[] = []
  if (trainer) {
    unsubs.push(
      trainer.onStateChange((state) =>
        useDeviceStore.setState({
          trainerState: state,
          trainerName: trainer.name,
          capabilities: trainer.capabilities,
          ...(state === 'connected' ? {} : { trainerData: null }),
        }),
      ),
      trainer.onData((data) => useDeviceStore.setState({ trainerData: data })),
    )
  }
  if (heartRate) {
    unsubs.push(
      heartRate.onStateChange((state) =>
        useDeviceStore.setState({
          heartRateState: state,
          heartRateName: heartRate.name,
          ...(state === 'connected' ? {} : { heartRateBpm: null }),
        }),
      ),
      heartRate.onData((d) => useDeviceStore.setState({ heartRateBpm: d.heartRateBpm })),
    )
  }
  return () => {
    for (const unsub of unsubs) unsub()
  }
}

/** ユーザーがデバイス選択ダイアログをキャンセルした場合は、エラーとして表示しない */
function isUserCancel(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'NotFoundError'
}

function errorDetail(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

async function runConnect(connect: () => Promise<void>) {
  useDeviceStore.setState({ error: null })
  try {
    await connect()
  } catch (e) {
    if (isUserCancel(e)) return
    console.error(e)
    useDeviceStore.setState({ error: { kind: 'connectFailed', detail: errorDetail(e) } })
  }
}

export const deviceActions = {
  connectTrainer() {
    const { trainer } = useDeviceStore.getState().devices
    if (trainer) return runConnect(() => trainer.connect())
  },
  disconnectTrainer() {
    return useDeviceStore.getState().devices.trainer?.disconnect()
  },
  connectHeartRate() {
    const { heartRate } = useDeviceStore.getState().devices
    if (heartRate) return runConnect(() => heartRate.connect())
  },
  disconnectHeartRate() {
    return useDeviceStore.getState().devices.heartRate?.disconnect()
  },
  reportCommandError(e: unknown) {
    console.error(e)
    useDeviceStore.setState({ error: { kind: 'commandFailed', detail: errorDetail(e) } })
  },
}

/** 表示用の心拍。心拍計を優先し、なければトレーナー経由の値を使う */
export function selectHeartRateBpm(s: DeviceStoreState): number | null {
  return s.heartRateBpm ?? s.trainerData?.heartRateBpm ?? null
}
