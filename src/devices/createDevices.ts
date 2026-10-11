import { createBleTransport } from './ble/createBleTransport.ts'
import { FtmsTrainer } from './ftms/FtmsTrainer.ts'
import { BleHeartRateSensor } from './heartRate/BleHeartRateSensor.ts'
import type { HeartRateSensor } from './HeartRateSensor.ts'
import { SimulatedHeartRateSensor } from './sim/SimulatedHeartRateSensor.ts'
import { SimulatedTrainer } from './sim/SimulatedTrainer.ts'
import type { TrainerDevice } from './TrainerDevice.ts'

export interface Devices {
  trainer: TrainerDevice | null
  heartRate: HeartRateSensor | null
}

/** 起動オプションと実行環境に応じてデバイスを作る。BLE が使えない環境では null。 */
export function createDevices(opts: { simulator: boolean }): Devices {
  if (opts.simulator) {
    const trainer = new SimulatedTrainer()
    return { trainer, heartRate: new SimulatedHeartRateSensor(trainer) }
  }
  const transport = createBleTransport()
  if (!transport) return { trainer: null, heartRate: null }
  return { trainer: new FtmsTrainer(transport), heartRate: new BleHeartRateSensor(transport) }
}
