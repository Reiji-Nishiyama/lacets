import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SimulatedHeartRateSensor } from '../devices/sim/SimulatedHeartRateSensor.ts'
import { SimulatedTrainer } from '../devices/sim/SimulatedTrainer.ts'
import { bindDevices, deviceActions, selectHeartRateBpm, useDeviceStore } from './deviceStore.ts'

let unbind: () => void

beforeEach(() => {
  vi.useFakeTimers()
  const trainer = new SimulatedTrainer({ random: () => 0.5 })
  unbind = bindDevices({ trainer, heartRate: new SimulatedHeartRateSensor(trainer) })
})

afterEach(() => {
  unbind()
  vi.useRealTimers()
})

describe('deviceStore', () => {
  it('トレーナーの状態とデータをストアに反映する', async () => {
    await deviceActions.connectTrainer()
    expect(useDeviceStore.getState().trainerState).toBe('connected')
    expect(useDeviceStore.getState().capabilities?.simulationSupported).toBe(true)
    vi.advanceTimersByTime(250)
    expect(useDeviceStore.getState().trainerData?.powerW).toBe(200)
    await deviceActions.disconnectTrainer()
    expect(useDeviceStore.getState().trainerData).toBeNull()
  })

  it('心拍計を接続すると心拍が入る', async () => {
    await deviceActions.connectTrainer()
    await deviceActions.connectHeartRate()
    vi.advanceTimersByTime(1000)
    expect(selectHeartRateBpm(useDeviceStore.getState())).toBeGreaterThan(70)
  })

  it('接続エラーを記録する。キャンセルは無視する', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { trainer } = useDeviceStore.getState().devices
    vi.spyOn(trainer!, 'connect').mockRejectedValueOnce(new Error('boom'))
    await deviceActions.connectTrainer()
    expect(useDeviceStore.getState().error).toEqual({ kind: 'connectFailed', detail: 'boom' })

    vi.spyOn(trainer!, 'connect').mockRejectedValueOnce(
      new DOMException('User cancelled', 'NotFoundError'),
    )
    await deviceActions.connectTrainer()
    expect(useDeviceStore.getState().error).toBeNull()
  })
})
